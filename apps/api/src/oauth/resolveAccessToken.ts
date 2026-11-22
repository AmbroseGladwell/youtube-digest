import { AccountId } from "../auth/AccountId.js";
import { hashToken } from "../auth/hashToken.js";
import type { SqlClient } from "../db/SqlClient.js";
import { CONNECTION_TOUCH_INTERVAL_MS } from "./connectionTimings.js";

export interface ConnectionAccess {
  connectionId: string;
  accountId: AccountId;
  scope: string;
  // Chosen by the assistant, so logged only as mcpAssistant's few names, never as written.
  clientName: string | null;
}

// A live token is the whole check, as any account can connect (docs/architecture/tiers.md).
export const resolveAccessToken = async (sql: SqlClient, token: string, now: Date): Promise<ConnectionAccess | null> => {
  const [row] = await sql.query<{
    id: string;
    account_id: string;
    scope: string;
    last_used_at: string | Date;
    client_name: string | null;
  }>(
    `select c.id, c.account_id, c.scope, c.last_used_at, cl.client_name
       from connection_tokens t
       join connections c on c.id = t.connection_id
       join oauth_clients cl on cl.id = c.client_id
      where t.token_hash = $1 and t.kind = 'access' and t.expires_at > $2::timestamptz`,
    [hashToken(token), now.toISOString()],
  );
  if (row === undefined) {
    return null;
  }
  if (now.getTime() - new Date(row.last_used_at).getTime() > CONNECTION_TOUCH_INTERVAL_MS) {
    await sql.query("update connections set last_used_at = $2::timestamptz where id = $1", [row.id, now.toISOString()]);
  }
  return {
    connectionId: row.id,
    accountId: AccountId.parse(row.account_id),
    scope: row.scope,
    clientName: row.client_name,
  };
};
