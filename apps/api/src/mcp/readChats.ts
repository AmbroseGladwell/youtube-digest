import { Chat, CHAT_MIGRATIONS, readStoredRecord, stampSchemaVersion } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import type { SqlClient } from "../db/SqlClient.js";

const readable = (rows: ReadonlyArray<{ schema_version: number; body: Record<string, unknown> }>): Chat[] =>
  rows.flatMap((row) => {
    const read = readStoredRecord(stampSchemaVersion(row.body, row.schema_version), Chat, CHAT_MIGRATIONS);
    return read.status === "read" ? [read.record] : [];
  });

// Apart from readLibrary, so only the calls that need conversations pay to read them. A
// deleted conversation is never read (docs/features/mcp-connector.md, "Chats"). With overview
// ids, only the chats those overviews own.
export const readChats = async (sql: SqlClient, accountId: AccountId, overviewIds?: readonly string[]): Promise<Chat[]> => {
  const rows = await sql.query<{ schema_version: number; body: Record<string, unknown> }>(
    overviewIds === undefined
      ? "select schema_version, body from records where account_id = $1 and kind = 'chat' and not deleted"
      : "select schema_version, body from records where account_id = $1 and kind = 'chat' and not deleted and body->>'overviewId' = any($2)",
    overviewIds === undefined ? [accountId] : [accountId, [...overviewIds]],
  );
  return readable(rows);
};

export const readChat = async (sql: SqlClient, accountId: AccountId, id: string): Promise<Chat | null> => {
  const rows = await sql.query<{ schema_version: number; body: Record<string, unknown> }>(
    "select schema_version, body from records where account_id = $1 and kind = 'chat' and id = $2 and not deleted",
    [accountId, id],
  );
  return readable(rows)[0] ?? null;
};

export const lastMessageAt = (chat: Chat): string => chat.messages.at(-1)?.at ?? chat.startedAt;
