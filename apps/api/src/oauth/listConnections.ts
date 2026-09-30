import type { Connection } from "@overview/domain";
import type { SqlClient } from "../db/SqlClient.js";

const iso = (value: string | Date): string => new Date(value).toISOString();

// A connection whose every token has lapsed can do nothing, so it is not listed as one.
export async function listConnections(sql: SqlClient, accountId: string, now: Date): Promise<Connection[]> {
  const rows = await sql.query<{ id: string; client_name: string | null; created_at: string | Date; last_used_at: string | Date }>(
    `select c.id, cl.client_name, c.created_at, c.last_used_at
       from connections c join oauth_clients cl on cl.id = c.client_id
      where c.account_id = $1
        and exists (select 1 from connection_tokens t
                     where t.connection_id = c.id and t.consumed_at is null and t.expires_at > $2::timestamptz)
      order by c.created_at desc`,
    [accountId, now.toISOString()],
  );
  return rows.map((row) => ({
    id: row.id,
    clientName: row.client_name,
    createdAt: iso(row.created_at),
    lastUsedAt: iso(row.last_used_at),
  }));
}
