import type { SqlClient } from "../db/SqlClient.js";

export async function deleteSession(sql: SqlClient, tokenHash: string): Promise<void> {
  await sql.query("delete from sessions where token_hash = $1", [tokenHash]);
}
