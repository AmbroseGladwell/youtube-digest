import Fastify, { type FastifyInstance } from "fastify";
import { AudioRenderQueue } from "./audio/AudioRenderQueue.js";
import { AudioRendersRepository } from "./audio/AudioRendersRepository.js";
import type { AudioStore } from "./audio/AudioStore.js";
import type { Narrator } from "./audio/Narrator.js";
import { VoiceSamplesRepository } from "./audio/VoiceSamplesRepository.js";
import { authRoutes } from "./auth/authRoutes.js";
import { sessionPlugin } from "./auth/sessionPlugin.js";
import { sessionRoutes } from "./auth/sessionRoutes.js";
import type { SqlClient } from "./db/SqlClient.js";
import { ApiError } from "./http/ApiError.js";
import { registerApiErrorHandler } from "./http/apiErrorHandler.js";
import { corsPlugin } from "./http/corsPlugin.js";
import { webAppPlugin } from "./http/webAppPlugin.js";
import type { Mailer } from "./mail/Mailer.js";
import { connectionRoutes } from "./oauth/connectionRoutes.js";
import { oauthRoutes } from "./oauth/oauthRoutes.js";
import { oauthUrls } from "./oauth/oauthUrls.js";
import { registerFormBodyParser } from "./oauth/registerFormBodyParser.js";
import { registerOAuthErrorHandler } from "./oauth/registerOAuthErrorHandler.js";
import { clientAddressPlugin } from "./rateLimit/clientAddressPlugin.js";
import { rateLimitHook } from "./rateLimit/rateLimitHook.js";
import { rateLimits } from "./rateLimit/rateLimits.js";
import { RecordsRepository } from "./records/RecordsRepository.js";
import { audioRoutes } from "./routes/audioRoutes.js";
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
  // The header a trusted proxy puts the caller's address in, or null to use the socket's.
  clientIpHeader: string | null;
}

export interface AudioSetup {
  narrator: Narrator;
  store: AudioStore;
  concurrency: number;
  // Off in tests, which drain the queue themselves rather than race a background worker.
  runWorkers: boolean;
}

export interface BuildAppOptions {
  config: AppConfig;
  sql: SqlClient;
  mailer: Mailer;
  audio?: AudioSetup | null;
  clock?: () => Date;
  logger?: boolean;
}

declare module "fastify" {
  interface FastifyContextConfig {
    public?: boolean;
  }
  interface FastifyInstance {
    audioQueue: AudioRenderQueue | null;
  }
}

// Hook order inside /api is address limit, parse, floor, session, account limit: a flood is
// refused before it costs a database round trip, and a client below the floor is told to
// update before it is told to sign in (docs/architecture/api.md).
export async function buildApp({
  config,
  sql,
  mailer,
  audio = null,
  clock = () => new Date(),
  logger = false,
}: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger });
  const sessionCookieSecure = config.appUrl.startsWith("https://");
  const urls = oauthUrls(config.appUrl);
  const audioRenders = new AudioRendersRepository(sql);
  const audioQueue =
    audio === null
      ? null
      : new AudioRenderQueue({ renders: audioRenders, clock, log: app.log, ...audio });
  app.decorate("audioQueue", audioQueue);

  await app.register(
    async (api) => {
      registerApiErrorHandler(api);
      if (config.allowedOrigins.length > 0) {
        await api.register(corsPlugin, { allowedOrigins: config.allowedOrigins });
      }
      await api.register(clientAddressPlugin, { clientIpHeader: config.clientIpHeader });
      api.addHook("onRequest", rateLimitHook(rateLimits.perAddress, (request) => request.clientAddress, clock));
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
      api.addHook(
        "onRequest",
        rateLimitHook(rateLimits.perAccount, (request) => request.session?.accountId ?? null, clock),
      );

      api.get("/health", { config: { public: true } }, async () => {
        try {
          await sql.query("select 1");
        } catch {
          throw new ApiError("unavailable", "The database is not reachable");
        }
        return { ok: true };
      });
      handshakeRoutes(api, config.minSupportedClientVersion);
      sessionRoutes(api, { sql, clock, sessionCookieSecure });
      authRoutes(api, {
        sql,
        clock,
        mailer,
        appUrl: config.appUrl,
        sessionTtlDays: config.sessionTtlDays,
        sessionCookieSecure,
      });
      connectionRoutes(api, { sql, clock, urls });

      const records = new RecordsRepository(sql, clock);
      changesRoutes(api, records);
      const transcripts = new TranscriptsRepository(sql, clock);
      overviewRoutes(api, records, transcripts);
      topicRoutes(api, records);
      settingsRoutes(api, records);
      transcriptRoutes(api, transcripts);
      audioRoutes(
        api,
        audio === null || audioQueue === null
          ? null
          : { renders: audioRenders, queue: audioQueue, store: audio.store, samples: new VoiceSamplesRepository(sql) },
        clock,
      );
    },
    { prefix: "/api" },
  );

  await app.register(async (oauth) => {
    registerOAuthErrorHandler(oauth);
    registerFormBodyParser(oauth);
    await oauth.register(clientAddressPlugin, { clientIpHeader: config.clientIpHeader });
    oauth.addHook("onRequest", rateLimitHook(rateLimits.perAddress, (request) => request.clientAddress, clock));
    oauthRoutes(oauth, { sql, clock, urls });
  });

  app.addHook("onReady", async () => {
    audioQueue?.kick();
  });

  if (config.staticRoot !== null) {
    await app.register(webAppPlugin, { root: config.staticRoot });
  }

  return app;
}
