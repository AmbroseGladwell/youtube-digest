import { Chat, CHAT_MIGRATIONS, readStoredRecord, stampSchemaVersion } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import type { SqlClient } from "../db/SqlClient.js";

// Apart from readLibrary, so only the calls that need conversations pay to read them. A
// deleted conversation is never read (docs/features/mcp-connector.md, "Chats").
export async function readChats(sql: SqlClient, accountId: AccountId, overviewIds?: readonly string[]): Promise<Chat[]> {
  const rows = await sql.query<{ schema_version: number; body: Record<string, unknown> }>(
    overviewIds === undefined
      ? "select schema_version, body from records where account_id = $1 and kind = 'chat' and not deleted"
      : "select schema_version, body from records where account_id = $1 and kind = 'chat' and not deleted and body->>'overviewId' = any($2)",
    overviewIds === undefined ? [accountId] : [accountId, [...overviewIds]],
  );
  return rows.flatMap((row) => {
    const read = readStoredRecord(stampSchemaVersion(row.body, row.schema_version), Chat, CHAT_MIGRATIONS);
    return read.status === "read" ? [read.record] : [];
  });
}

export const lastMessageAt = (chat: Chat): string => chat.messages.at(-1)?.at ?? chat.startedAt;
