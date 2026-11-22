import type { SqlClient } from "../db/SqlClient.js";

export interface RevokeConnectionOptions {
  accountId: string;
  id: string;
}

export const revokeConnection = async (sql: SqlClient, { accountId, id }: RevokeConnectionOptions): Promise<boolean> => {
  const rows = await sql.query<{ id: string }>("delete from connections where id::text = $1 and account_id = $2 returning id", [
    id,
    accountId,
  ]);
  return rows.length > 0;
};
