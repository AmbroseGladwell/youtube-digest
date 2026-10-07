import fp from "fastify-plugin";
import { bearerToken } from "../auth/bearerToken.js";
import type { SqlClient } from "../db/SqlClient.js";
import { logRefused } from "../http/logRefused.js";
import { bindLogContext } from "../logs/bindLogContext.js";
import { CONNECTION_SCOPES } from "../oauth/connectionScope.js";
import type { OAuthUrls } from "../oauth/oauthUrls.js";
import { resolveAccessToken, type ConnectionAccess } from "../oauth/resolveAccessToken.js";

export interface ConnectionAccessPluginOptions {
  sql: SqlClient;
  clock: () => Date;
  urls: OAuthUrls;
}

declare module "fastify" {
  interface FastifyRequest {
    connectionAccess: ConnectionAccess | null;
  }
}

// Only an assistant's access token opens /mcp, never a session, as only /mcp honours one
// (docs/features/mcp-connector.md). The challenge names the metadata an MCP client follows
// to find the authorization server (RFC 9728).
export const connectionAccessPlugin = fp<ConnectionAccessPluginOptions>(async (app, { sql, clock, urls }) => {
  app.decorateRequest("connectionAccess", null);
  app.addHook("onRequest", async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    const access = token === null ? null : await resolveAccessToken(sql, token, clock());
    if (access === null) {
      const challenge = [
        `Bearer resource_metadata="${urls.resourceMetadata}"`,
        `scope="${CONNECTION_SCOPES.join(" ")}"`,
        ...(token === null ? [] : ['error="invalid_token"']),
      ].join(", ");
      logRefused(request, "invalid_token", 401);
      return reply
        .status(401)
        .header("www-authenticate", challenge)
        .header("cache-control", "no-store")
        .send({ error: "invalid_token", error_description: "A connection's access token is required" });
    }
    request.connectionAccess = access;
    bindLogContext(request, reply, { accountId: access.accountId, connectionId: access.connectionId });
  });
});
