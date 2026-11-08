import {
  MAGIC_LINK_COOLDOWN_SECONDS,
  MAGIC_LINK_TTL_MINUTES,
  type AuthIntent,
  type AuthSurface,
} from "@overview/domain";
import type { SqlClient } from "../db/SqlClient.js";
import { generateToken } from "./generateToken.js";
import { hashToken } from "./hashToken.js";
import { formatLinkCode, generateLinkCode } from "./linkCode.js";
import { normaliseEmail } from "./normaliseEmail.js";

export const MAGIC_LINK_TTL_MS = MAGIC_LINK_TTL_MINUTES * 60 * 1000;
export const MAGIC_LINK_COOLDOWN_MS = MAGIC_LINK_COOLDOWN_SECONDS * 1000;

export interface IssuedMagicLink {
  email: string;
  token: string;
  // Only a web link carries one: an extension link already leads to a code of its own.
  code: string | null;
  expiresAt: string;
}

// One link per address per minute, so a public endpoint that sends mail cannot be turned
// on someone's inbox. Inside the cooldown nothing is issued and the caller answers exactly
// as if it had been. A spent link only holds the cooldown: it is never mailed and can never
// sign in (docs/features/sign-in.md).
export async function issueMagicLink(
  sql: SqlClient,
  {
    email: rawEmail,
    surface,
    intent,
    firstName,
    anonymousId,
    spent,
    now,
  }: {
    email: string;
    surface: AuthSurface;
    intent: AuthIntent;
    firstName: string | null;
    anonymousId: string | null;
    spent: boolean;
    now: Date;
  },
): Promise<IssuedMagicLink | null> {
  const email = normaliseEmail(rawEmail);
  const recent = await sql.query<{ id: string }>(
    "select id from magic_links where email = $1 and created_at > $2::timestamptz limit 1",
    [email, new Date(now.getTime() - MAGIC_LINK_COOLDOWN_MS).toISOString()],
  );
  if (recent.length > 0) {
    return null;
  }
  const token = generateToken();
  const code = surface === "web" ? generateLinkCode() : null;
  const expiresAt = new Date(now.getTime() + MAGIC_LINK_TTL_MS).toISOString();
  await sql.query(
    `insert into magic_links (email, surface, intent, first_name, anonymous_id, token_hash, code_hash, created_at, expires_at, consumed_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9::timestamptz, case when $10 then $8::timestamptz end)`,
    [
      email,
      surface,
      intent,
      firstName,
      anonymousId,
      hashToken(token),
      code === null ? null : hashToken(code),
      now.toISOString(),
      expiresAt,
      spent,
    ],
  );
  return { email, token, code: code === null ? null : formatLinkCode(code), expiresAt };
}
