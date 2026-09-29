import {
  MAGIC_LINK_COOLDOWN_SECONDS,
  MAGIC_LINK_TTL_MINUTES,
  type AuthIntent,
  type AuthSurface,
} from "@overview/domain";
import type { SqlClient } from "../db/SqlClient.js";
import { generateToken } from "./generateToken.js";
import { hashToken } from "./hashToken.js";
import { normaliseEmail } from "./normaliseEmail.js";

export const MAGIC_LINK_TTL_MS = MAGIC_LINK_TTL_MINUTES * 60 * 1000;
export const MAGIC_LINK_COOLDOWN_MS = MAGIC_LINK_COOLDOWN_SECONDS * 1000;

export interface IssuedMagicLink {
  email: string;
  token: string;
  expiresAt: string;
}

// One link per address per minute, so a public endpoint that sends mail cannot be turned
// on someone's inbox. Inside the cooldown nothing is issued and the caller answers exactly
// as if it had been (docs/features/sign-in.md).
export async function issueMagicLink(
  sql: SqlClient,
  {
    email: rawEmail,
    surface,
    intent,
    firstName,
    now,
  }: { email: string; surface: AuthSurface; intent: AuthIntent; firstName: string | null; now: Date },
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
  const expiresAt = new Date(now.getTime() + MAGIC_LINK_TTL_MS).toISOString();
  await sql.query(
    `insert into magic_links (email, surface, intent, first_name, token_hash, created_at, expires_at)
       values ($1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz)`,
    [email, surface, intent, firstName, hashToken(token), now.toISOString(), expiresAt],
  );
  return { email, token, expiresAt };
}
