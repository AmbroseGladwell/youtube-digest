import type { SqlClient } from "../db/SqlClient.js";
import { normaliseEmail } from "./normaliseEmail.js";

export async function accountExists(sql: SqlClient, email: string): Promise<boolean> {
  const rows = await sql.query("select 1 from accounts where email = $1", [normaliseEmail(email)]);
  return rows.length > 0;
}
