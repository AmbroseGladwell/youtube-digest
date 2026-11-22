import type { SqlClient } from "../db/SqlClient.js";

// Its tokens cascade, so revoking is immediate: docs/features/mcp-connector.md, "Tokens".
export const deleteConnection = async (sql: SqlClient, id: string): Promise<void> => {
  await sql.query("delete from connections where id = $1", [id]);
};
