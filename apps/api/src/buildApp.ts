import Fastify, { type FastifyInstance } from "fastify";
import { sessionPlugin } from "./auth/sessionPlugin.js";
import { sessionRoutes } from "./auth/sessionRoutes.js";
import type { SqlClient } from "./db/SqlClient.js";
import { ApiError } from "./http/ApiError.js";
import { registerApiErrorHandler } from "./http/apiErrorHandler.js";
import { RecordsRepository } from "./records/RecordsRepository.js";
import { changesRoutes } from "./routes/changesRoutes.js";
import { overviewRoutes } from "./routes/overviewRoutes.js";
import { settingsRoutes } from "./routes/settingsRoutes.js";
import { topicRoutes } from "./routes/topicRoutes.js";
import { clientVersionPlugin } from "./versions/clientVersionPlugin.js";
import { handshakeRoutes } from "./versions/handshakeRoutes.js";
import { writeFloorPlugin } from "./versions/writeFloorPlugin.js";

export interface AppConfig {
  minSupportedClientVersion: number;
  sessionTtlDays: number;
}

export interface BuildAppOptions {
  config: AppConfig;
  sql: SqlClient;
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
  clock = () => new Date(),
  logger = false,
}: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger });

  await app.register(
    async (api) => {
      registerApiErrorHandler(api);
      await api.register(clientVersionPlugin);
      await api.register(writeFloorPlugin, {
        minSupportedClientVersion: config.minSupportedClientVersion,
      });
      await api.register(sessionPlugin, { sql, clock, sessionTtlDays: config.sessionTtlDays });

      api.get("/health", { config: { public: true } }, async () => {
        try {
          await sql.query("select 1");
        } catch {
          throw new ApiError("unavailable", "The database is not reachable");
        }
        return { ok: true };
      });
      handshakeRoutes(api, config.minSupportedClientVersion);
      sessionRoutes(api, sql);

      const records = new RecordsRepository(sql, clock);
      changesRoutes(api, records);
      overviewRoutes(api, records);
      topicRoutes(api, records);
      settingsRoutes(api, records);
    },
    { prefix: "/api" },
  );

  return app;
}
