import { CLIENT_VERSION, CLIENT_VERSION_HEADER } from "@overview/domain";
import type { SqlClient } from "../db/SqlClient.js";
import { createSession } from "./createSession.js";
import type { AccountId } from "./AccountId.js";

export interface TestSession {
  accountId: AccountId;
  token: string;
  headers: Record<string, string>;
}

let emails = 0;

export async function makeSession(
  sql: SqlClient,
  { email = `reader${++emails}@example.com`, now = new Date(), sessionTtlDays = 30 } = {},
): Promise<TestSession> {
  const { token, accountId } = await createSession(sql, email, { now, sessionTtlDays });
  return {
    accountId,
    token,
    headers: { authorization: `Bearer ${token}`, [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION) },
  };
}
