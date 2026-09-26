import fp from "fastify-plugin";
import type { SqlClient } from "../db/SqlClient.js";
import { ApiError } from "../http/ApiError.js";
import { bearerToken } from "./bearerToken.js";
import { resolveSession } from "./resolveSession.js";
import type { Session } from "./Session.js";

export interface SessionPluginOptions {
  sql: SqlClient;
  clock: () => Date;
  sessionTtlDays: number;
}

declare module "fastify" {
  interface FastifyRequest {
    session: Session | null;
  }
}

// Deny by default: a route is public only by saying so. Missing, unknown and expired
// tokens get one answer, because the client has one response to all three and a prober
// learns nothing (docs/architecture/api.md).
export const sessionPlugin = fp<SessionPluginOptions>(async (app, { sql, clock, sessionTtlDays }) => {
  app.decorateRequest("session", null);
  app.addHook("onRequest", async (request, reply) => {
    if (request.is404 || request.routeOptions.config.public) {
      return;
    }
    const token = bearerToken(request.headers.authorization);
    const session =
      token === null ? null : await resolveSession(sql, token, { now: clock(), sessionTtlDays });
    if (session === null) {
      reply.header("www-authenticate", 'Bearer realm="api"');
      throw new ApiError("unauthenticated", "Sign in to use the API");
    }
    request.session = session;
  });
});
