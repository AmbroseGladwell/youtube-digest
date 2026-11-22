import type { FastifyInstance } from "fastify";
import type { SqlClient } from "../db/SqlClient.js";
import { ApiError } from "../http/ApiError.js";

// Why /live never touches the database: docs/architecture/deploy.md, "The machine".
export const healthRoutes = (app: FastifyInstance, sql: SqlClient): void => {
  app.get("/live", { config: { public: true } }, async () => ({ ok: true }));
  app.get("/health", { config: { public: true } }, async () => {
    try {
      await sql.query("select 1");
    } catch {
      throw new ApiError("unavailable", "The database is not reachable");
    }
    return { ok: true };
  });
};
