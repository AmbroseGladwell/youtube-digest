import type { SqlClient } from "../db/SqlClient.js";
import type { AccountId } from "./AccountId.js";
import { hashToken } from "./hashToken.js";
import { formatLinkCode, generateLinkCode } from "./linkCode.js";

export const LINK_CODE_TTL_MS = 10 * 60 * 1000;

export interface IssuedLinkCode {
  code: string;
  expiresAt: string;
}

export async function issueLinkCode(
  sql: SqlClient,
  accountId: AccountId,
  now: Date,
): Promise<IssuedLinkCode> {
  const code = generateLinkCode();
  const expiresAt = new Date(now.getTime() + LINK_CODE_TTL_MS).toISOString();
  await sql.query(
    "insert into link_codes (account_id, code_hash, created_at, expires_at) values ($1, $2, $3::timestamptz, $4::timestamptz)",
    [accountId, hashToken(code), now.toISOString(), expiresAt],
  );
  return { code: formatLinkCode(code), expiresAt };
}
