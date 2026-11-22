import fp from "fastify-plugin";
import type { SqlClient } from "../db/SqlClient.js";
import { ApiError } from "../http/ApiError.js";
import { bindLogContext } from "../logs/bindLogContext.js";
import { bearerToken } from "./bearerToken.js";
import { resolveSession } from "./resolveSession.js";
import type { Session } from "./Session.js";
import { readSessionCookie, sessionCookie } from "./sessionCookie.js";

export interface SessionPluginOptions {
  sql: SqlClient;
  clock: () => Date;
  sessionTtlDays: number;
  sessionCookieSecure: boolean;
}

declare module "fastify" {
  interface FastifyRequest {
    session: Session | null;
  }
}

// Deny by default, one answer to missing, unknown and expired: docs/architecture/api.md, "Auth".
export const sessionPlugin = fp<SessionPluginOptions>(async (app, { sql, clock, sessionTtlDays, sessionCookieSecure }) => {
  app.decorateRequest("session", null);
  app.addHook("onRequest", async (request, reply) => {
    if (request.is404 || request.routeOptions.config.public) {
      return;
    }
    const bearer = bearerToken(request.headers.authorization);
    const token = bearer ?? readSessionCookie(request.headers.cookie);
    const now = clock();
    const resolved =
      token === null ? null : await resolveSession(sql, token, bearer === null ? "cookie" : "bearer", { now, sessionTtlDays });
    if (resolved === null) {
      if (request.routeOptions.config.optionalSession) {
        return;
      }
      reply.header("www-authenticate", 'Bearer realm="api"');
      throw new ApiError("unauthenticated", "Sign in to use the API");
    }
    if (resolved.slid && resolved.session.transport === "cookie") {
      reply.header("set-cookie", sessionCookie(token!, { expiresAt: resolved.session.expiresAt, now, secure: sessionCookieSecure }));
    }
    request.session = resolved.session;
    bindLogContext(request, reply, { accountId: resolved.session.accountId, sessionId: resolved.session.id });
  });
});
