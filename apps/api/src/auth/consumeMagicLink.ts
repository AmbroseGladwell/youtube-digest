import { AuthSurface } from "@overview/domain";
import type { SqlClient } from "../db/SqlClient.js";
import { hashToken } from "./hashToken.js";

export interface ConsumedMagicLink {
  email: string;
  surface: AuthSurface;
}

// One statement marks the link used and reads it, so two clicks on the same link cannot
// both sign in: the second finds nothing to update (docs/features/sign-in.md).
export async function consumeMagicLink(
  sql: SqlClient,
  token: string,
  now: Date,
): Promise<ConsumedMagicLink | null> {
  const rows = await sql.query<{ email: string; surface: string }>(
    `update magic_links set consumed_at = $2::timestamptz
      where token_hash = $1 and consumed_at is null and expires_at > $2::timestamptz
      returning email, surface`,
    [hashToken(token), now.toISOString()],
  );
  const row = rows[0];
  return row === undefined ? null : { email: row.email, surface: AuthSurface.parse(row.surface) };
}
