import type { SqlClient } from "../db/SqlClient.js";
import { AUTHORIZATION_TTL_MS } from "./connectionTimings.js";
import { CONNECTION_SCOPES, grantedScope } from "./connectionScope.js";
import { findClient } from "./findClient.js";
import type { OAuthUrls } from "./oauthUrls.js";
import { S256_CHALLENGE } from "./verifierMatches.js";
import { withQueryParams } from "./withQueryParams.js";

export type AuthorizationStart =
  | { kind: "refuse"; reason: string }
  | { kind: "redirect"; location: string };

type Query = Record<string, string | undefined>;

const sameResource = (asked: string, ours: string): boolean => asked.replace(/\/+$/, "") === ours;

// A bad client or redirect URI is shown to the reader and never redirected to, so this can't
// be used to bounce someone to an address of the caller's choosing. Anything else wrong goes
// back to the client as an error on its own redirect (RFC 6749 §4.1.2.1).
export async function startAuthorization(
  sql: SqlClient,
  query: Query,
  { urls, now }: { urls: OAuthUrls; now: Date },
): Promise<AuthorizationStart> {
  const client = query.client_id === undefined ? null : await findClient(sql, query.client_id);
  if (client === null) {
    return { kind: "refuse", reason: "This app is not registered to connect." };
  }
  const redirectUri =
    query.redirect_uri ?? (client.redirectUris.length === 1 ? client.redirectUris[0]! : undefined);
  if (redirectUri === undefined || !client.redirectUris.includes(redirectUri)) {
    return { kind: "refuse", reason: "This app asked to return somewhere it did not register." };
  }

  const back = (error: string, description: string): AuthorizationStart => ({
    kind: "redirect",
    location: withQueryParams(redirectUri, {
      error,
      error_description: description,
      state: query.state,
      iss: urls.issuer,
    }),
  });
  if (query.response_type !== "code") {
    return back("unsupported_response_type", "Only the authorization code flow is supported");
  }
  if (query.code_challenge_method !== "S256" || query.code_challenge === undefined || !S256_CHALLENGE.test(query.code_challenge)) {
    return back("invalid_request", "PKCE with S256 is required");
  }
  const scope = grantedScope(query.scope);
  if (scope === null) {
    return back("invalid_scope", `The scopes are ${CONNECTION_SCOPES.join(" and ")}`);
  }
  if (query.resource !== undefined && !sameResource(query.resource, urls.resource)) {
    return back("invalid_target", `The only resource is ${urls.resource}`);
  }

  const [row] = await sql.query<{ id: string }>(
    `insert into oauth_authorizations (client_id, redirect_uri, state, code_challenge, scope, resource, created_at, expires_at)
       values ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz)
       returning id`,
    [
      client.id,
      redirectUri,
      query.state ?? null,
      query.code_challenge,
      scope,
      query.resource === undefined ? null : urls.resource,
      now.toISOString(),
      new Date(now.getTime() + AUTHORIZATION_TTL_MS).toISOString(),
    ],
  );
  return { kind: "redirect", location: urls.consent(row!.id) };
}
