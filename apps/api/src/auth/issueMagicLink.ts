import type { AuthSurface } from "@overview/domain";
import type { SqlClient } from "../db/SqlClient.js";
import { generateToken } from "./generateToken.js";
import { hashToken } from "./hashToken.js";
import { normaliseEmail } from "./normaliseEmail.js";

export const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
export const MAGIC_LINK_COOLDOWN_MS = 60 * 1000;

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
  { email: rawEmail, surface, now }: { email: string; surface: AuthSurface; now: Date },
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
    "insert into magic_links (email, surface, token_hash, created_at, expires_at) values ($1, $2, $3, $4::timestamptz, $5::timestamptz)",
    [email, surface, hashToken(token), now.toISOString(), expiresAt],
  );
  return { email, token, expiresAt };
}
