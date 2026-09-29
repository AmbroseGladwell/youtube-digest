import Fastify, { type FastifyInstance } from "fastify";
import { authRoutes } from "./auth/authRoutes.js";
import { sessionPlugin } from "./auth/sessionPlugin.js";
import { sessionRoutes } from "./auth/sessionRoutes.js";
import type { SqlClient } from "./db/SqlClient.js";
import { ApiError } from "./http/ApiError.js";
import { registerApiErrorHandler } from "./http/apiErrorHandler.js";
import { corsPlugin } from "./http/corsPlugin.js";
import { webAppPlugin } from "./http/webAppPlugin.js";
import type { Mailer } from "./mail/Mailer.js";
import { RecordsRepository } from "./records/RecordsRepository.js";
import { changesRoutes } from "./routes/changesRoutes.js";
import { overviewRoutes } from "./routes/overviewRoutes.js";
import { settingsRoutes } from "./routes/settingsRoutes.js";
import { topicRoutes } from "./routes/topicRoutes.js";
import { transcriptRoutes } from "./routes/transcriptRoutes.js";
import { TranscriptsRepository } from "./transcripts/TranscriptsRepository.js";
import { clientVersionPlugin } from "./versions/clientVersionPlugin.js";
import { handshakeRoutes } from "./versions/handshakeRoutes.js";
import { writeFloorPlugin } from "./versions/writeFloorPlugin.js";

export interface AppConfig {
  minSupportedClientVersion: number;
  sessionTtlDays: number;
  allowedOrigins: string[];
  // Where the web app is served from: the origin a magic link opens, and the origin the
  // session cookie is Secure on when it is https (docs/features/sign-in.md).
  appUrl: string;
  staticRoot: string | null;
}

export interface BuildAppOptions {
  config: AppConfig;
  sql: SqlClient;
  mailer: Mailer;
  clock?: () => Date;
  logger?: boolean;
}

declare module "fastify" {
  interface FastifyContextConfig {
    public?: boolean;
  }
}

// Hook order inside /api is parse, floor, session: a client below the floor is told to
// update before it is told to sign in, and without a database round trip
// (docs/architecture/api.md).
export async function buildApp({
  config,
  sql,
  mailer,
  clock = () => new Date(),
  logger = false,
}: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger });
  const sessionCookieSecure = config.appUrl.startsWith("https://");

  await app.register(
    async (api) => {
      registerApiErrorHandler(api);
      if (config.allowedOrigins.length > 0) {
        await api.register(corsPlugin, { allowedOrigins: config.allowedOrigins });
      }
      await api.register(clientVersionPlugin);
      await api.register(writeFloorPlugin, {
        minSupportedClientVersion: config.minSupportedClientVersion,
      });
      await api.register(sessionPlugin, {
        sql,
        clock,
        sessionTtlDays: config.sessionTtlDays,
        sessionCookieSecure,
      });

      api.get("/health", { config: { public: true } }, async () => {
        try {
          await sql.query("select 1");
        } catch {
          throw new ApiError("unavailable", "The database is not reachable");
        }
        return { ok: true };
      });
      handshakeRoutes(api, config.minSupportedClientVersion);
      sessionRoutes(api, sql, sessionCookieSecure);
      authRoutes(api, {
        sql,
        clock,
        mailer,
        appUrl: config.appUrl,
        sessionTtlDays: config.sessionTtlDays,
        sessionCookieSecure,
      });

      const records = new RecordsRepository(sql, clock);
      changesRoutes(api, records);
      overviewRoutes(api, records);
      topicRoutes(api, records);
      settingsRoutes(api, records);
      transcriptRoutes(api, new TranscriptsRepository(sql, clock));
    },
    { prefix: "/api" },
  );

  if (config.staticRoot !== null) {
    await app.register(webAppPlugin, { root: config.staticRoot });
  }

  return app;
}
