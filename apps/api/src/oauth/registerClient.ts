import type { SqlClient } from "../db/SqlClient.js";
import { generateToken } from "../auth/generateToken.js";
import { hashToken } from "../auth/hashToken.js";
import type { ClientRegistration } from "./ClientRegistration.js";
import { isAllowedRedirectUri } from "./isAllowedRedirectUri.js";
import { OAuthError } from "./OAuthError.js";

export interface RegisteredClient {
  client_id: string;
  client_id_issued_at: number;
  client_secret?: string;
  client_secret_expires_at?: number;
  client_name?: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
}

// Dynamic registration is open, as MCP clients expect: a client is only a name and where to
// send the reader back, and it can read nothing until a reader approves it
// (docs/features/mcp-connector.md, "Registering a client").
export async function registerClient(
  sql: SqlClient,
  registration: ClientRegistration,
  now: Date,
): Promise<RegisteredClient> {
  const refused = registration.redirect_uris.find((uri) => !isAllowedRedirectUri(uri));
  if (refused !== undefined) {
    throw new OAuthError("invalid_redirect_uri", "Redirect URIs must be https, or http to this machine, with no fragment");
  }
  const clientId = generateToken();
  const method = registration.token_endpoint_auth_method;
  const secret = method === "none" ? null : generateToken();
  await sql.query(
    `insert into oauth_clients (id, client_name, redirect_uris, token_endpoint_auth_method, client_secret_hash, created_at)
       values ($1, $2, $3, $4, $5, $6::timestamptz)`,
    [clientId, registration.client_name ?? null, registration.redirect_uris, method, secret === null ? null : hashToken(secret), now.toISOString()],
  );
  return {
    client_id: clientId,
    client_id_issued_at: Math.floor(now.getTime() / 1000),
    ...(secret === null ? {} : { client_secret: secret, client_secret_expires_at: 0 }),
    ...(registration.client_name === undefined ? {} : { client_name: registration.client_name }),
    redirect_uris: registration.redirect_uris,
    grant_types: registration.grant_types,
    response_types: registration.response_types,
    token_endpoint_auth_method: method,
  };
}
