import type { SqlClient } from "../db/SqlClient.js";
import { TokenEndpointAuthMethod } from "./ClientRegistration.js";
import type { OAuthClient } from "./OAuthClient.js";

interface ClientRow {
  id: string;
  client_name: string | null;
  redirect_uris: string[];
  token_endpoint_auth_method: string;
  client_secret_hash: string | null;
}

export async function findClient(sql: SqlClient, clientId: string): Promise<OAuthClient | null> {
  const [row] = await sql.query<ClientRow>(
    "select id, client_name, redirect_uris, token_endpoint_auth_method, client_secret_hash from oauth_clients where id = $1",
    [clientId],
  );
  return row === undefined
    ? null
    : {
        id: row.id,
        clientName: row.client_name,
        redirectUris: row.redirect_uris,
        tokenEndpointAuthMethod: TokenEndpointAuthMethod.parse(row.token_endpoint_auth_method),
        clientSecretHash: row.client_secret_hash,
      };
}
