import { chatRecordId, type ChatMessage } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import { ApiError } from "../http/ApiError.js";
import { decideMerge } from "../records/decideMerge.js";
import type { RecordsRepository, WriteOutcome } from "../records/RecordsRepository.js";
import { serverClientContext } from "../versions/serverClientContext.js";

export interface ChatAppend {
  overviewId: string;
  conversationId: string;
  messages: readonly ChatMessage[];
}

const appended = (base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> => ({
  ...base,
  messages: [...(Array.isArray(base.messages) ? base.messages : []), ...(patch.messages as unknown[])],
});

// The server writes a chat, since the answer is its own, and devices get it down the feed. Only
// while the overview is there, so a chat can never outlive the sweep that follows its overview's
// delete; and never onto a conversation the reader deleted (docs/features/chats.md).
export async function appendChatMessages(
  records: RecordsRepository,
  accountId: AccountId,
  { overviewId, conversationId, messages }: ChatAppend,
  now: Date,
): Promise<WriteOutcome> {
  const id = chatRecordId(overviewId, conversationId);
  const at = now.toISOString();
  const [written] = await records.write(accountId, [
    {
      kind: "chat",
      id,
      requires: [{ kind: "overview", id: overviewId }],
      decide: (current, _held, [overview]) => {
        if (overview === null || overview === undefined || overview.deleted) throw new ApiError("not_found", "No such overview");
        if (current?.deleted === true) throw new ApiError("not_found", "That conversation was deleted");
        return decideMerge(
          "chat",
          current,
          { patch: { messages }, updatedAt: at, ifMatch: null, defaults: { id, overviewId, startedAt: at, messages: [] }, merge: appended },
          serverClientContext,
        );
      },
    },
  ]);
  return written!;
}
