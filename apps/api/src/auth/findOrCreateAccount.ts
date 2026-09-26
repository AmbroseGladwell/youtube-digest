import type { SqlClient } from "../db/SqlClient.js";
import { AccountId } from "./AccountId.js";
import { normaliseEmail } from "./normaliseEmail.js";

export async function findOrCreateAccount(sql: SqlClient, email: string): Promise<AccountId> {
  const rows = await sql.query<{ id: string }>(
    "insert into accounts (email) values ($1) on conflict (email) do update set email = excluded.email returning id",
    [normaliseEmail(email)],
  );
  return AccountId.parse(rows[0]!.id);
}
