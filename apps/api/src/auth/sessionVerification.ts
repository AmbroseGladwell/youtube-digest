import { FRESH_SESSION_MINUTES, MAGIC_LINK_COOLDOWN_SECONDS, SESSION_VERIFICATION_TTL_MINUTES } from "@overview/domain";
import type { SqlClient } from "../db/SqlClient.js";
import { hashToken } from "./hashToken.js";
import { formatLinkCode, generateLinkCode, normaliseLinkCode } from "./linkCode.js";
import type { Session } from "./Session.js";

const MINUTE_MS = 60 * 1000;
export const SESSION_VERIFICATION_TTL_MS = SESSION_VERIFICATION_TTL_MINUTES * MINUTE_MS;
export const FRESH_SESSION_MS = FRESH_SESSION_MINUTES * MINUTE_MS;
const COOLDOWN_MS = MAGIC_LINK_COOLDOWN_SECONDS * 1000;

// A session that was made or verified in the last fifteen minutes has already proved its
// inbox: a code to the account's own address would ask the same thing twice. The verified
// time is read here rather than with every session, so the request path that every call
// takes never depends on this slice's column (docs/features/account-changes.md).
export async function isSessionVerified(sql: SqlClient, session: Session, now: Date): Promise<boolean> {
  const since = (at: string) => now.getTime() - new Date(at).getTime();
  if (since(session.createdAt) < FRESH_SESSION_MS) {
    return true;
  }
  const rows = await sql.query<{ verified_at: string | Date | null }>("select verified_at from sessions where id = $1", [session.id]);
  const verifiedAt = rows[0]?.verified_at ?? null;
  return verifiedAt !== null && since(new Date(verifiedAt).toISOString()) < SESSION_VERIFICATION_TTL_MS;
}

export interface IssuedVerification {
  code: string;
  expiresAt: string;
}

// Null inside the cooldown: the last code is still live and nothing new goes out.
export async function issueSessionVerification(
  sql: SqlClient,
  sessionId: string,
  now: Date,
): Promise<IssuedVerification | null> {
  const recent = await sql.query<{ id: string }>(
    "select id from session_verifications where session_id = $1 and created_at > $2::timestamptz limit 1",
    [sessionId, new Date(now.getTime() - COOLDOWN_MS).toISOString()],
  );
  if (recent.length > 0) {
    return null;
  }
  const code = generateLinkCode();
  const expiresAt = new Date(now.getTime() + SESSION_VERIFICATION_TTL_MS).toISOString();
  await sql.query(
    "insert into session_verifications (session_id, code_hash, created_at, expires_at) values ($1, $2, $3::timestamptz, $4::timestamptz)",
    [sessionId, hashToken(code), now.toISOString(), expiresAt],
  );
  return { code: formatLinkCode(code), expiresAt };
}

// One statement spends the code, and only a code made for this very session counts.
export async function confirmSessionVerification(
  sql: SqlClient,
  sessionId: string,
  code: string,
  now: Date,
): Promise<boolean> {
  const rows = await sql.query<{ id: string }>(
    `update session_verifications set consumed_at = $3::timestamptz
      where session_id = $1 and code_hash = $2 and consumed_at is null and expires_at > $3::timestamptz
      returning id`,
    [sessionId, hashToken(normaliseLinkCode(code)), now.toISOString()],
  );
  if (rows.length === 0) {
    return false;
  }
  await sql.query("update sessions set verified_at = $2::timestamptz where id = $1", [sessionId, now.toISOString()]);
  return true;
}
