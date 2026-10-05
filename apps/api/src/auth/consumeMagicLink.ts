import { AuthIntent, AuthSurface } from "@overview/domain";
import type { SqlClient } from "../db/SqlClient.js";
import { hashToken } from "./hashToken.js";
import { normaliseEmail } from "./normaliseEmail.js";
import { normaliseLinkCode } from "./linkCode.js";

export interface ConsumedMagicLink {
  email: string;
  surface: AuthSurface;
  intent: AuthIntent;
  firstName: string | null;
  anonymousId: string | null;
}

interface MagicLinkRow {
  email: string;
  surface: string;
  intent: string;
  first_name: string | null;
  anonymous_id: string | null;
}

const RETURNING = "returning email, surface, intent, first_name, anonymous_id";

const consumed = (rows: MagicLinkRow[]): ConsumedMagicLink | null => {
  const row = rows[0];
  return row === undefined
    ? null
    : {
        email: row.email,
        surface: AuthSurface.parse(row.surface),
        intent: AuthIntent.parse(row.intent),
        firstName: row.first_name,
        anonymousId: row.anonymous_id,
      };
};

// One statement marks the link used and reads it, so two clicks on the same link cannot
// both sign in: the second finds nothing to update (docs/features/sign-in.md).
export async function consumeMagicLink(
  sql: SqlClient,
  token: string,
  now: Date,
): Promise<ConsumedMagicLink | null> {
  return consumed(
    await sql.query<MagicLinkRow>(
      `update magic_links set consumed_at = $2::timestamptz
        where token_hash = $1 and consumed_at is null and expires_at > $2::timestamptz
        ${RETURNING}`,
      [hashToken(token), now.toISOString()],
    ),
  );
}

// The code in a web mail spends the same row as its link, so one mail signs in once
// whichever way it is used, and a code only works with the address it was sent to
// (docs/features/sign-in.md, "A code in the web mail").
export async function consumeMagicLinkCode(
  sql: SqlClient,
  email: string,
  code: string,
  now: Date,
): Promise<ConsumedMagicLink | null> {
  return consumed(
    await sql.query<MagicLinkRow>(
      `update magic_links set consumed_at = $3::timestamptz
        where email = $1 and code_hash = $2 and consumed_at is null and expires_at > $3::timestamptz
        ${RETURNING}`,
      [normaliseEmail(email), hashToken(normaliseLinkCode(code)), now.toISOString()],
    ),
  );
}
