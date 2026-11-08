import type { SqlClient } from "../db/SqlClient.js";
import { AccountId } from "./AccountId.js";
import type { FoundAccount } from "./findOrCreateAccount.js";
import { normaliseEmail } from "./normaliseEmail.js";

export async function findAccount(sql: SqlClient, email: string): Promise<FoundAccount | null> {
  const [row] = await sql.query<{ id: string; first_name: string | null }>(
    "select id, first_name from accounts where email = $1",
    [normaliseEmail(email)],
  );
  return row === undefined ? null : { id: AccountId.parse(row.id), firstName: row.first_name, created: false };
}
