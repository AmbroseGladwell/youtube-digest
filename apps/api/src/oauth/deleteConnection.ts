import type { SqlClient } from "../db/SqlClient.js";

// Deleting the connection takes every token it issued with it, so revoking is immediate.
export async function deleteConnection(sql: SqlClient, id: string): Promise<void> {
  await sql.query("delete from connections where id = $1", [id]);
}
