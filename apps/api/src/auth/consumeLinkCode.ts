import type { SqlClient } from "../db/SqlClient.js";
import { AccountId } from "./AccountId.js";
import { hashToken } from "./hashToken.js";
import { normaliseLinkCode } from "./linkCode.js";

export async function consumeLinkCode(sql: SqlClient, input: string, now: Date): Promise<AccountId | null> {
  const rows = await sql.query<{ account_id: string }>(
    `update link_codes set consumed_at = $2::timestamptz
      where code_hash = $1 and consumed_at is null and expires_at > $2::timestamptz
      returning account_id`,
    [hashToken(normaliseLinkCode(input)), now.toISOString()],
  );
  const row = rows[0];
  return row === undefined ? null : AccountId.parse(row.account_id);
}
