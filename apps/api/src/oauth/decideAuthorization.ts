import type { AccountId } from "../auth/AccountId.js";
import { generateToken } from "../auth/generateToken.js";
import { hashToken } from "../auth/hashToken.js";
import type { SqlClient } from "../db/SqlClient.js";
import { AUTHORIZATION_CODE_TTL_MS } from "./connectionTimings.js";
import type { OAuthUrls } from "./oauthUrls.js";
import { withQueryParams } from "./withQueryParams.js";

// One statement decides and reads, so a request can be decided once: a second answer finds
// nothing left to update.
export async function decideAuthorization(
  sql: SqlClient,
  { id, accountId, approve, urls, now }: { id: string; accountId: AccountId; approve: boolean; urls: OAuthUrls; now: Date },
): Promise<string | null> {
  const code = approve ? generateToken() : null;
  const [row] = await sql.query<{ redirect_uri: string; state: string | null }>(
    `update oauth_authorizations
        set decided_at = $2::timestamptz, approved = $3, account_id = $4,
            code_hash = $5, code_expires_at = $6::timestamptz
      where id = $1 and decided_at is null and expires_at > $2::timestamptz
      returning redirect_uri, state`,
    [
      id,
      now.toISOString(),
      approve,
      accountId,
      code === null ? null : hashToken(code),
      code === null ? null : new Date(now.getTime() + AUTHORIZATION_CODE_TTL_MS).toISOString(),
    ],
  );
  if (row === undefined) {
    return null;
  }
  return withQueryParams(row.redirect_uri, {
    ...(code === null
      ? { error: "access_denied", error_description: "The reader did not allow the connection" }
      : { code }),
    state: row.state,
    iss: urls.issuer,
  });
}
