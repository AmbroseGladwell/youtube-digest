import type { SqlClient } from "../db/SqlClient.js";
import { AccountId } from "./AccountId.js";
import { hashSessionToken } from "./hashSessionToken.js";
import type { Session } from "./Session.js";
import { sessionExpiry } from "./sessionExpiry.js";

export const SESSION_TOUCH_INTERVAL_MS = 60 * 60 * 1000;

interface SessionRow {
  account_id: string;
  email: string;
  expires_at: string | Date;
  last_seen_at: string | Date;
}

const iso = (value: string | Date): string => new Date(value).toISOString();

// A sliding expiry, slid at most once an hour so a busy client is not rewriting the row on
// every request (docs/architecture/api.md).
export async function resolveSession(
  sql: SqlClient,
  token: string,
  { now, sessionTtlDays }: { now: Date; sessionTtlDays: number },
): Promise<Session | null> {
  const tokenHash = hashSessionToken(token);
  const rows = await sql.query<SessionRow>(
    `select s.account_id, a.email, s.expires_at, s.last_seen_at
       from sessions s join accounts a on a.id = s.account_id
      where s.token_hash = $1 and s.expires_at > $2::timestamptz`,
    [tokenHash, now.toISOString()],
  );
  const row = rows[0];
  if (row === undefined) {
    return null;
  }

  let expiresAt = iso(row.expires_at);
  if (now.getTime() - new Date(row.last_seen_at).getTime() > SESSION_TOUCH_INTERVAL_MS) {
    expiresAt = sessionExpiry(now, sessionTtlDays);
    await sql.query(
      "update sessions set last_seen_at = $2::timestamptz, expires_at = $3::timestamptz where token_hash = $1",
      [tokenHash, now.toISOString(), expiresAt],
    );
  }
  return { accountId: AccountId.parse(row.account_id), email: row.email, expiresAt, tokenHash };
}
