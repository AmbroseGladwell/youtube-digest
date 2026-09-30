import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import type { SqlClient } from "../db/SqlClient.js";
import type { RateLimit } from "../rateLimit/RateLimit.js";
import { rateLimitHook } from "../rateLimit/rateLimitHook.js";
import { rateLimits } from "../rateLimit/rateLimits.js";
import { authenticateClient } from "./authenticateClient.js";
import { ClientRegistration } from "./ClientRegistration.js";
import { CONNECTION_SCOPE } from "./connectionScope.js";
import { exchangeCode } from "./exchangeCode.js";
import { OAuthError } from "./OAuthError.js";
import type { OAuthUrls } from "./oauthUrls.js";
import { refreshTokens } from "./refreshTokens.js";
import { registerClient } from "./registerClient.js";
import { revokeToken } from "./revokeToken.js";
import { startAuthorization } from "./startAuthorization.js";
import type { TokenGrant } from "./TokenGrant.js";

export interface OAuthRoutesOptions {
  sql: SqlClient;
  clock: () => Date;
  urls: OAuthUrls;
}

const Form = z.record(z.string(), z.unknown());
const AuthorizeQuery = z.record(z.string(), z.string());

const text = (value: unknown): string | undefined => (typeof value === "string" && value !== "" ? value : undefined);

function required(body: Record<string, unknown>, name: string): string {
  const value = text(body[name]);
  if (value === undefined) {
    throw new OAuthError("invalid_request", `${name} is required`);
  }
  return value;
}

function parseOrOAuthError<T>(schema: z.ZodType<T>, value: unknown, code: "invalid_request" | "invalid_client_metadata"): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new OAuthError(code, z.prettifyError(parsed.error));
  }
  return parsed.data;
}

const noStore = (reply: FastifyReply) => reply.header("cache-control", "no-store").header("pragma", "no-cache");

// The authorization server MCP clients discover and talk to, outside /api because they send
// none of our clients' headers (docs/features/mcp-connector.md).
export function oauthRoutes(app: FastifyInstance, { sql, clock, urls }: OAuthRoutesOptions): void {
  const perAddress = (rateLimit: RateLimit) => rateLimitHook(rateLimit, (request) => request.clientAddress, clock);

  app.get("/.well-known/oauth-authorization-server", async () => ({
    issuer: urls.issuer,
    authorization_endpoint: urls.authorize,
    token_endpoint: urls.token,
    registration_endpoint: urls.register,
    revocation_endpoint: urls.revoke,
    scopes_supported: [CONNECTION_SCOPE],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    revocation_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    authorization_response_iss_parameter_supported: true,
  }));

  const protectedResource = async () => ({
    resource: urls.resource,
    authorization_servers: [urls.issuer],
    scopes_supported: [CONNECTION_SCOPE],
    bearer_methods_supported: ["header"],
  });
  app.get("/.well-known/oauth-protected-resource", protectedResource);
  app.get("/.well-known/oauth-protected-resource/mcp", protectedResource);

  app.post("/oauth/register", { preHandler: perAddress(rateLimits.oauthRegisterPerAddress) }, async (request, reply) => {
    const registration = parseOrOAuthError(ClientRegistration, request.body, "invalid_client_metadata");
    const registered = await registerClient(sql, registration, clock());
    request.log.info({ authMethod: registered.token_endpoint_auth_method }, "oauth client registered");
    return noStore(reply).status(201).send(registered);
  });

  app.get("/oauth/authorize", async (request, reply) => {
    const query = parseOrOAuthError(AuthorizeQuery, request.query, "invalid_request");
    const start = await startAuthorization(sql, query, { urls, now: clock() });
    noStore(reply);
    if (start.kind === "refuse") {
      return reply.status(400).type("text/plain; charset=utf-8").send(start.reason);
    }
    return reply.redirect(start.location, 302);
  });

  app.post("/oauth/token", { preHandler: perAddress(rateLimits.oauthTokenPerAddress) }, async (request, reply) => {
    const body = parseOrOAuthError(Form, request.body ?? {}, "invalid_request");
    const client = await authenticateClient(sql, request.headers.authorization, body);
    const now = clock();
    let grant: TokenGrant;
    switch (body.grant_type) {
      case "authorization_code":
        grant = await exchangeCode(sql, {
          client,
          exchange: {
            code: required(body, "code"),
            codeVerifier: required(body, "code_verifier"),
            redirectUri: text(body.redirect_uri),
            resource: text(body.resource),
          },
          urls,
          now,
        });
        break;
      case "refresh_token":
        grant = await refreshTokens(sql, { client, refreshToken: required(body, "refresh_token"), now });
        break;
      default:
        throw new OAuthError("unsupported_grant_type", "Only authorization_code and refresh_token are supported");
    }
    if (grant.kind === "replayed") {
      request.log.warn({ connectionId: grant.connectionId, reason: "replayed" }, "connection revoked");
      throw new OAuthError("invalid_grant", "This grant was already used");
    }
    if (grant.kind === "refused") {
      throw new OAuthError("invalid_grant", grant.description);
    }
    if (grant.created) {
      request.log.info({ connectionId: grant.connectionId }, "connection made");
    }
    return noStore(reply).send(grant.tokens);
  });

  app.post("/oauth/revoke", { preHandler: perAddress(rateLimits.oauthTokenPerAddress) }, async (request, reply) => {
    const body = parseOrOAuthError(Form, request.body ?? {}, "invalid_request");
    const client = await authenticateClient(sql, request.headers.authorization, body);
    const revoked = await revokeToken(sql, { token: required(body, "token"), clientId: client.id });
    if (revoked !== null) {
      request.log.info({ connectionId: revoked, by: "client" }, "connection revoked");
    }
    return noStore(reply).status(200).send();
  });
}
