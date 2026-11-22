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

// One statement, so two clicks cannot both sign in: docs/features/sign-in.md, "Decisions, and why".
export const consumeMagicLink = async (sql: SqlClient, token: string, now: Date): Promise<ConsumedMagicLink | null> => {
  return consumed(
    await sql.query<MagicLinkRow>(
      `update magic_links set consumed_at = $2::timestamptz
        where token_hash = $1 and consumed_at is null and expires_at > $2::timestamptz
        ${RETURNING}`,
      [hashToken(token), now.toISOString()],
    ),
  );
};

// Spends the link's row, so one mail signs in once: docs/features/sign-in.md, "A code in the web mail".
export const consumeMagicLinkCode = async (sql: SqlClient, email: string, code: string, now: Date): Promise<ConsumedMagicLink | null> => {
  return consumed(
    await sql.query<MagicLinkRow>(
      `update magic_links set consumed_at = $3::timestamptz
        where email = $1 and code_hash = $2 and consumed_at is null and expires_at > $3::timestamptz
        ${RETURNING}`,
      [normaliseEmail(email), hashToken(normaliseLinkCode(code)), now.toISOString()],
    ),
  );
};
