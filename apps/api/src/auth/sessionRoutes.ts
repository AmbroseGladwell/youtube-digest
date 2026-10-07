import type { FastifyInstance } from "fastify";
import { apiLogLines, type LinkCode, type SessionInfo } from "@overview/domain";
import type { SqlClient } from "../db/SqlClient.js";
import { deleteSession } from "./deleteSession.js";
import { issueLinkCode } from "./issueLinkCode.js";
import { accountPlan } from "./accountPlan.js";
import { clearedSessionCookie } from "./sessionCookie.js";

export interface SessionRoutesOptions {
  sql: SqlClient;
  clock: () => Date;
  sessionCookieSecure: boolean;
}

export function sessionRoutes(app: FastifyInstance, { sql, clock, sessionCookieSecure }: SessionRoutesOptions): void {
  app.get("/session", async (request) => {
    const { accountId, email, firstName, expiresAt } = request.session!;
    const info: SessionInfo = { accountId, email, firstName, expiresAt, plan: await accountPlan(sql, accountId) };
    return info;
  });

  app.post("/session/link-code", async (request) => {
    const issued = await issueLinkCode(sql, request.session!.accountId, clock());
    request.log.info(apiLogLines.auth.linkCodeIssued({ transport: request.session!.transport }));
    const linkCode: LinkCode = { linkCode: issued.code, linkCodeExpiresAt: issued.expiresAt };
    return linkCode;
  });

  app.delete("/session", async (request, reply) => {
    const session = request.session!;
    await deleteSession(sql, session.tokenHash);
    request.log.info(apiLogLines.auth.signedOut({ transport: session.transport }));
    if (session.transport === "cookie") {
      reply.header("set-cookie", clearedSessionCookie({ secure: sessionCookieSecure }));
    }
    return reply.status(204).send();
  });
}
