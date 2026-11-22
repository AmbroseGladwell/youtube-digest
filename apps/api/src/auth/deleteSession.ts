import type { SqlClient } from "../db/SqlClient.js";

export const deleteSession = async (sql: SqlClient, tokenHash: string): Promise<void> => {
  await sql.query("delete from sessions where token_hash = $1", [tokenHash]);
};
