import type { SqlClient } from "../db/SqlClient.js";

export interface PendingAuthorization {
  id: string;
  clientName: string | null;
  redirectUri: string;
  expiresAt: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function findPendingAuthorization(
  sql: SqlClient,
  id: string,
  now: Date,
): Promise<PendingAuthorization | null> {
  if (!UUID.test(id)) {
    return null;
  }
  const [row] = await sql.query<{ id: string; client_name: string | null; redirect_uri: string; expires_at: string | Date }>(
    `select a.id, c.client_name, a.redirect_uri, a.expires_at
       from oauth_authorizations a join oauth_clients c on c.id = a.client_id
      where a.id = $1 and a.decided_at is null and a.expires_at > $2::timestamptz`,
    [id, now.toISOString()],
  );
  return row === undefined
    ? null
    : { id: row.id, clientName: row.client_name, redirectUri: row.redirect_uri, expiresAt: new Date(row.expires_at).toISOString() };
}
