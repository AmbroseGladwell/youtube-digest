import type { SqlClient } from "../db/SqlClient.js";
import { findOrCreateAccount } from "./findOrCreateAccount.js";
import { generateToken } from "./generateToken.js";
import { hashToken } from "./hashToken.js";
import { sessionExpiry } from "./sessionExpiry.js";
import type { AccountId } from "./AccountId.js";

export interface CreatedSession {
  id: string;
  token: string;
  accountId: AccountId;
  expiresAt: string;
}

export interface CreateSessionOptions {
  now: Date;
  sessionTtlDays: number;
}

// The only place a raw token exists: it is handed back once and only its hash is kept
// (docs/architecture/api.md).
export async function createSessionForAccount(
  sql: SqlClient,
  accountId: AccountId,
  { now, sessionTtlDays }: CreateSessionOptions,
): Promise<CreatedSession> {
  const token = generateToken();
  const expiresAt = sessionExpiry(now, sessionTtlDays);
  const [row] = await sql.query<{ id: string }>(
    "insert into sessions (account_id, token_hash, created_at, expires_at, last_seen_at) values ($1, $2, $3::timestamptz, $4::timestamptz, $3::timestamptz) returning id",
    [accountId, hashToken(token), now.toISOString(), expiresAt],
  );
  return { id: row!.id, token, accountId, expiresAt };
}

export async function createSession(
  sql: SqlClient,
  email: string,
  options: CreateSessionOptions,
): Promise<CreatedSession> {
  return createSessionForAccount(sql, (await findOrCreateAccount(sql, email)).id, options);
}
