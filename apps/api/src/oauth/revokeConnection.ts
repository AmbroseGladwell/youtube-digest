import type { SqlClient } from "../db/SqlClient.js";

export async function revokeConnection(sql: SqlClient, { accountId, id }: { accountId: string; id: string }): Promise<boolean> {
  const rows = await sql.query<{ id: string }>(
    "delete from connections where id::text = $1 and account_id = $2 returning id",
    [id, accountId],
  );
  return rows.length > 0;
}
