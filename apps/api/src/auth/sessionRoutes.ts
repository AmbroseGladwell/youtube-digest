import type { FastifyInstance } from "fastify";
import type { SqlClient } from "../db/SqlClient.js";
import { deleteSession } from "./deleteSession.js";

export function sessionRoutes(app: FastifyInstance, sql: SqlClient): void {
  app.get("/session", async (request) => {
    const { accountId, email, expiresAt } = request.session!;
    return { accountId, email, expiresAt };
  });

  app.delete("/session", async (request, reply) => {
    await deleteSession(sql, request.session!.tokenHash);
    return reply.status(204).send();
  });
}
