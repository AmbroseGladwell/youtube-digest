import type { FastifyInstance } from "fastify";
import type { SqlClient } from "../db/SqlClient.js";
import { ApiError } from "../http/ApiError.js";

// /live is Fly's periodic check and never touches the database, so Neon can suspend while
// the machine idles; /health is the deploy job's, and asks the database (docs/architecture/deploy.md).
export function healthRoutes(app: FastifyInstance, sql: SqlClient): void {
  app.get("/live", { config: { public: true } }, async () => ({ ok: true }));
  app.get("/health", { config: { public: true } }, async () => {
    try {
      await sql.query("select 1");
    } catch {
      throw new ApiError("unavailable", "The database is not reachable");
    }
    return { ok: true };
  });
}
