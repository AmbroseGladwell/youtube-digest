import { AccountId } from "../auth/AccountId.js";
import { hashToken } from "../auth/hashToken.js";
import type { SqlClient } from "../db/SqlClient.js";
import { deleteConnection } from "./deleteConnection.js";
import { issueTokens } from "./issueTokens.js";
import type { OAuthClient } from "./OAuthClient.js";
import type { OAuthUrls } from "./oauthUrls.js";
import type { TokenGrant } from "./TokenGrant.js";
import { verifierMatches } from "./verifierMatches.js";

interface CodeRow {
  id: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  scope: string;
  resource: string | null;
  account_id: string;
  code_expires_at: string | Date;
  code_consumed_at: string | Date | null;
  connection_id: string | null;
}

export interface CodeExchange {
  code: string;
  redirectUri: string | undefined;
  codeVerifier: string;
  resource: string | undefined;
}

// A code is spent once. A second exchange of the same code means it leaked, so the
// connection the first one made is revoked (OAuth 2.1 §4.1.3; docs/features/mcp-connector.md).
export async function exchangeCode(
  sql: SqlClient,
  { client, exchange, urls, now }: { client: OAuthClient; exchange: CodeExchange; urls: OAuthUrls; now: Date },
): Promise<TokenGrant> {
  return sql.transaction(async (tx) => {
    const [row] = await tx.query<CodeRow>(
      `select id, client_id, redirect_uri, code_challenge, scope, resource, account_id,
              code_expires_at, code_consumed_at, connection_id
         from oauth_authorizations
        where code_hash = $1
        for update`,
      [hashToken(exchange.code)],
    );
    if (row === undefined || row.client_id !== client.id) {
      return { kind: "refused", description: "The code is not valid" };
    }
    if (row.code_consumed_at !== null) {
      if (row.connection_id !== null) {
        await deleteConnection(tx, row.connection_id);
      }
      return { kind: "replayed", connectionId: row.connection_id };
    }
    if (new Date(row.code_expires_at).getTime() <= now.getTime()) {
      return { kind: "refused", description: "The code has expired" };
    }
    if (exchange.redirectUri !== undefined && exchange.redirectUri !== row.redirect_uri) {
      return { kind: "refused", description: "The redirect URI does not match the authorization" };
    }
    if (!verifierMatches(exchange.codeVerifier, row.code_challenge)) {
      return { kind: "refused", description: "The code verifier does not match" };
    }
    if (exchange.resource !== undefined && exchange.resource.replace(/\/+$/, "") !== urls.resource) {
      return { kind: "refused", description: `The only resource is ${urls.resource}` };
    }

    const [connection] = await tx.query<{ id: string }>(
      `insert into connections (account_id, client_id, scope, created_at, last_used_at)
         values ($1, $2, $3, $4::timestamptz, $4::timestamptz) returning id`,
      [row.account_id, client.id, row.scope, now.toISOString()],
    );
    await tx.query(
      "update oauth_authorizations set code_consumed_at = $2::timestamptz, connection_id = $3 where id = $1",
      [row.id, now.toISOString(), connection!.id],
    );
    const tokens = await issueTokens(tx, { connectionId: connection!.id, scope: row.scope, now });
    return { kind: "issued", tokens, connectionId: connection!.id, accountId: AccountId.parse(row.account_id), created: true };
  });
}
