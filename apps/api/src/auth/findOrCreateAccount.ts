import type { SqlClient } from "../db/SqlClient.js";
import { AccountId } from "./AccountId.js";
import { normaliseEmail } from "./normaliseEmail.js";

export interface FoundAccount {
  id: AccountId;
  firstName: string | null;
  created: boolean;
}

// A name is only ever written by the insert: an existing account keeps its own
// (docs/features/sign-in.md, "Creating an account").
export async function findOrCreateAccount(
  sql: SqlClient,
  email: string,
  firstName: string | null = null,
): Promise<FoundAccount> {
  const rows = await sql.query<{ id: string; first_name: string | null; created: boolean }>(
    `insert into accounts (email, first_name) values ($1, $2)
       on conflict (email) do update set email = excluded.email
       returning id, first_name, (xmax = 0) as created`,
    [normaliseEmail(email), firstName],
  );
  const row = rows[0]!;
  return { id: AccountId.parse(row.id), firstName: row.first_name, created: row.created };
}
