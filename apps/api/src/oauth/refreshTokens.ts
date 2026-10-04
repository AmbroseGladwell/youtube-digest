import { canConnectAssistant, type Plan } from "@overview/domain";
import { AccountId } from "../auth/AccountId.js";
import { hashToken } from "../auth/hashToken.js";
import type { SqlClient } from "../db/SqlClient.js";
import { deleteConnection } from "./deleteConnection.js";
import { issueTokens } from "./issueTokens.js";
import type { OAuthClient } from "./OAuthClient.js";
import type { TokenGrant } from "./TokenGrant.js";

interface RefreshRow {
  connection_id: string;
  expires_at: string | Date;
  consumed_at: string | Date | null;
  client_id: string;
  account_id: string;
  scope: string;
  plan: Plan;
}

// Refresh tokens rotate: each is spent once, and presenting a spent one means it was copied,
// so the whole connection goes (OAuth 2.1 §4.3.1; docs/features/mcp-connector.md).
export async function refreshTokens(
  sql: SqlClient,
  { client, refreshToken, now }: { client: OAuthClient; refreshToken: string; now: Date },
): Promise<TokenGrant> {
  return sql.transaction(async (tx) => {
    const tokenHash = hashToken(refreshToken);
    const [row] = await tx.query<RefreshRow>(
      `select t.connection_id, t.expires_at, t.consumed_at, c.client_id, c.account_id, c.scope, a.plan
         from connection_tokens t
         join connections c on c.id = t.connection_id
         join accounts a on a.id = c.account_id
        where t.token_hash = $1 and t.kind = 'refresh'
        for update of t`,
      [tokenHash],
    );
    if (row === undefined || row.client_id !== client.id) {
      return { kind: "refused", description: "The refresh token is not valid" };
    }
    if (row.consumed_at !== null) {
      await deleteConnection(tx, row.connection_id);
      return { kind: "replayed", connectionId: row.connection_id };
    }
    if (new Date(row.expires_at).getTime() <= now.getTime()) {
      return { kind: "refused", description: "The refresh token has expired" };
    }
    if (!canConnectAssistant(row.plan)) {
      return { kind: "refused", description: "Connecting an assistant needs Plus" };
    }

    await tx.query("update connection_tokens set consumed_at = $2::timestamptz where token_hash = $1", [
      tokenHash,
      now.toISOString(),
    ]);
    await tx.query("delete from connection_tokens where connection_id = $1 and expires_at <= $2::timestamptz", [
      row.connection_id,
      now.toISOString(),
    ]);
    await tx.query("update connections set last_used_at = $2::timestamptz where id = $1", [
      row.connection_id,
      now.toISOString(),
    ]);
    const tokens = await issueTokens(tx, { connectionId: row.connection_id, scope: row.scope, now });
    return { kind: "issued", tokens, connectionId: row.connection_id, accountId: AccountId.parse(row.account_id), created: false };
  });
}
