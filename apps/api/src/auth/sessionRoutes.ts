import type { FastifyInstance } from "fastify";
import type { SessionInfo } from "@overview/domain";
import type { SqlClient } from "../db/SqlClient.js";
import { deleteSession } from "./deleteSession.js";
import { clearedSessionCookie } from "./sessionCookie.js";

export function sessionRoutes(app: FastifyInstance, sql: SqlClient, sessionCookieSecure: boolean): void {
  app.get("/session", async (request) => {
    const { accountId, email, firstName, expiresAt } = request.session!;
    const info: SessionInfo = { accountId, email, firstName, expiresAt };
    return info;
  });

  app.delete("/session", async (request, reply) => {
    const session = request.session!;
    await deleteSession(sql, session.tokenHash);
    if (session.transport === "cookie") {
      reply.header("set-cookie", clearedSessionCookie({ secure: sessionCookieSecure }));
    }
    return reply.status(204).send();
  });
}
