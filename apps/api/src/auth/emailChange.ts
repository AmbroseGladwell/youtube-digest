import {
  EMAIL_CHANGE_REVERT_DAYS,
  EMAIL_CHANGE_TTL_MINUTES,
  MAGIC_LINK_COOLDOWN_SECONDS,
  type EmailChangeRevertRefusal,
} from "@overview/domain";
import type { SqlClient } from "../db/SqlClient.js";
import { AccountId } from "./AccountId.js";
import { generateToken } from "./generateToken.js";
import { hashToken } from "./hashToken.js";
import { formatLinkCode, generateLinkCode, normaliseLinkCode } from "./linkCode.js";
import { normaliseEmail } from "./normaliseEmail.js";

const MINUTE_MS = 60 * 1000;
export const EMAIL_CHANGE_TTL_MS = EMAIL_CHANGE_TTL_MINUTES * MINUTE_MS;
export const EMAIL_CHANGE_REVERT_MS = EMAIL_CHANGE_REVERT_DAYS * 24 * 60 * MINUTE_MS;
const COOLDOWN_MS = MAGIC_LINK_COOLDOWN_SECONDS * 1000;

const UNIQUE_VIOLATION = "23505";

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === UNIQUE_VIOLATION;

export interface IssuedEmailChange {
  newEmail: string;
  // Null when the address already has an account: docs/features/account-changes.md, "The email, in four steps".
  code: string | null;
  expiresAt: string;
}

export interface IssueEmailChangeOptions {
  accountId: AccountId;
  oldEmail: string;
  newEmail: string;
  now: Date;
}

// Null inside the cooldown. A taken address is told only to its inbox, so the route answers the same.
export const issueEmailChange = async (
  sql: SqlClient,
  { accountId, oldEmail, newEmail: rawNewEmail, now }: IssueEmailChangeOptions,
): Promise<IssuedEmailChange | null> => {
  const newEmail = normaliseEmail(rawNewEmail);
  const recent = await sql.query<{ id: string }>(
    "select id from email_changes where account_id = $1 and new_email = $2 and created_at > $3::timestamptz limit 1",
    [accountId, newEmail, new Date(now.getTime() - COOLDOWN_MS).toISOString()],
  );
  if (recent.length > 0) {
    return null;
  }
  const taken = await sql.query<{ id: string }>("select id from accounts where email = $1", [newEmail]);
  const code = taken.length === 0 ? generateLinkCode() : null;
  const expiresAt = new Date(now.getTime() + EMAIL_CHANGE_TTL_MS).toISOString();
  await sql.query(
    `insert into email_changes (account_id, old_email, new_email, code_hash, created_at, expires_at)
       values ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz)`,
    [accountId, oldEmail, newEmail, code === null ? null : hashToken(code), now.toISOString(), expiresAt],
  );
  return { newEmail, code: code === null ? null : formatLinkCode(code), expiresAt };
};

export type ConfirmedEmailChange =
  | { outcome: "changed"; oldEmail: string; newEmail: string; revertToken: string }
  | { outcome: "invalid" }
  | { outcome: "taken"; newEmail: string };

// Moves once though confirmed on two devices: docs/features/account-changes.md, "The email, in four steps".
export const confirmEmailChange = async (sql: SqlClient, accountId: AccountId, code: string, now: Date): Promise<ConfirmedEmailChange> => {
  const consumed = await sql.query<{ id: string; old_email: string; new_email: string }>(
    `update email_changes set consumed_at = $3::timestamptz
      where account_id = $1 and code_hash = $2 and consumed_at is null and expires_at > $3::timestamptz
      returning id, old_email, new_email`,
    [accountId, hashToken(normaliseLinkCode(code)), now.toISOString()],
  );
  const change = consumed[0];
  if (change === undefined) {
    return { outcome: "invalid" };
  }
  let moved: { id: string }[];
  try {
    moved = await sql.query<{ id: string }>("update accounts set email = $2 where id = $1 and email = $3 returning id", [
      accountId,
      change.new_email,
      change.old_email,
    ]);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { outcome: "taken", newEmail: change.new_email };
    }
    throw error;
  }
  if (moved.length === 0) {
    return { outcome: "invalid" };
  }
  const revertToken = generateToken();
  await sql.query("update email_changes set revert_token_hash = $2, revert_expires_at = $3::timestamptz where id = $1", [
    change.id,
    hashToken(revertToken),
    new Date(now.getTime() + EMAIL_CHANGE_REVERT_MS).toISOString(),
  ]);
  return { outcome: "changed", oldEmail: change.old_email, newEmail: change.new_email, revertToken };
};

export type RevertedEmailChange =
  | { outcome: "reverted"; accountId: AccountId; email: string }
  | { outcome: "refused"; reason: Exclude<EmailChangeRevertRefusal, "taken"> }
  // Where the link was sent, so the page can name it: no secret to whoever holds the link.
  | { outcome: "refused"; reason: "taken"; email: string };

// Only while the email is the one that change made: docs/features/account-changes.md, "Moving it back".
export const revertEmailChange = async (sql: SqlClient, token: string, now: Date): Promise<RevertedEmailChange> => {
  const tokenHash = hashToken(token);
  const rows = await sql.query<{ id: string; account_id: string; old_email: string; new_email: string }>(
    `update email_changes set reverted_at = $2::timestamptz
      where revert_token_hash = $1 and reverted_at is null and revert_expires_at > $2::timestamptz
      returning id, account_id, old_email, new_email`,
    [tokenHash, now.toISOString()],
  );
  const change = rows[0];
  if (change === undefined) {
    const known = await sql.query<{ reverted_at: string | null; revert_expires_at: string }>(
      "select reverted_at, revert_expires_at from email_changes where revert_token_hash = $1",
      [tokenHash],
    );
    const row = known[0];
    const expired = row !== undefined && row.reverted_at === null && new Date(row.revert_expires_at).getTime() <= now.getTime();
    return { outcome: "refused", reason: expired ? "expired" : "spent" };
  }
  const accountId = AccountId.parse(change.account_id);
  let moved: { id: string }[];
  try {
    moved = await sql.query<{ id: string }>("update accounts set email = $2 where id = $1 and email = $3 returning id", [
      accountId,
      change.old_email,
      change.new_email,
    ]);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { outcome: "refused", reason: "taken", email: change.old_email };
    }
    throw error;
  }
  if (moved.length === 0) {
    return { outcome: "refused", reason: "spent" };
  }
  await sql.query("delete from sessions where account_id = $1", [accountId]);
  await sql.query("update email_changes set consumed_at = $2::timestamptz where account_id = $1 and consumed_at is null", [
    accountId,
    now.toISOString(),
  ]);
  return { outcome: "reverted", accountId, email: change.old_email };
};
