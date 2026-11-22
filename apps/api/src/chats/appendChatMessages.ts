import { chatRecordId, type ChatMessage, type ChatOwner } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import { ApiError } from "../http/ApiError.js";
import { decideMerge } from "../records/decideMerge.js";
import type { RecordsRepository, WriteOutcome } from "../records/RecordsRepository.js";
import { serverClientContext } from "../versions/serverClientContext.js";

export interface ChatAppend {
  owner: ChatOwner;
  conversationId: string;
  messages: readonly ChatMessage[];
}

const appended = (base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> => ({
  ...base,
  messages: [...(Array.isArray(base.messages) ? base.messages : []), ...(patch.messages as unknown[])],
});

// The server writes a chat, since the answer is its own, and devices get it down the feed. Only
// while its owner, an overview or a project, is there, so a chat can never outlive the sweep that
// follows its owner's delete; a library chat has no owner to wait on. Never onto a conversation
// the reader deleted (docs/features/chats.md).
export const appendChatMessages = async (
  records: RecordsRepository,
  accountId: AccountId,
  { owner, conversationId, messages }: ChatAppend,
  now: Date,
): Promise<WriteOutcome> => {
  const id = chatRecordId(owner, conversationId);
  const at = now.toISOString();
  const ownerField = owner.kind === "overview" ? { overviewId: owner.id } : owner.kind === "project" ? { projectId: owner.id } : {};
  const [written] = await records.write(accountId, [
    {
      kind: "chat",
      id,
      requires: owner.kind === "library" ? [] : [{ kind: owner.kind, id: owner.id }],
      decide: (current, _held, [held]) => {
        if (owner.kind !== "library" && (held === null || held === undefined || held.deleted)) {
          throw new ApiError("not_found", owner.kind === "overview" ? "No such overview" : "No such project");
        }
        if (current?.deleted === true) {
          throw new ApiError("not_found", "That conversation was deleted");
        }
        return decideMerge(
          "chat",
          current,
          {
            patch: { messages },
            updatedAt: at,
            ifMatch: null,
            defaults: { id, ...ownerField, startedAt: at, messages: [] },
            merge: appended,
          },
          serverClientContext,
        );
      },
    },
  ]);
  return written!;
};
