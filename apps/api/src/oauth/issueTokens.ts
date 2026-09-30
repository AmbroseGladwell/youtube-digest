import { generateToken } from "../auth/generateToken.js";
import { hashToken } from "../auth/hashToken.js";
import type { SqlClient } from "../db/SqlClient.js";
import { ACCESS_TOKEN_TTL_MS, REFRESH_TOKEN_TTL_MS } from "./connectionTimings.js";

export interface TokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}

// The only place a connection's raw tokens exist: handed back once, kept as hashes.
export async function issueTokens(
  sql: SqlClient,
  { connectionId, scope, now }: { connectionId: string; scope: string; now: Date },
): Promise<TokenResponse> {
  const access = generateToken();
  const refresh = generateToken();
  const insert = (token: string, kind: "access" | "refresh", ttlMs: number) =>
    sql.query(
      `insert into connection_tokens (token_hash, connection_id, kind, created_at, expires_at)
         values ($1, $2, $3, $4::timestamptz, $5::timestamptz)`,
      [hashToken(token), connectionId, kind, now.toISOString(), new Date(now.getTime() + ttlMs).toISOString()],
    );
  await insert(access, "access", ACCESS_TOKEN_TTL_MS);
  await insert(refresh, "refresh", REFRESH_TOKEN_TTL_MS);
  return {
    access_token: access,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_MS / 1000,
    refresh_token: refresh,
    scope,
  };
}
