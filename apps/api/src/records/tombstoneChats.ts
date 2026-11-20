import { chatOwnerPrefix, type ChatOwner } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import type { RecordsRepository } from "./RecordsRepository.js";
import { tombstoneLiveRecords } from "./tombstoneLiveRecords.js";

// An overview's or a project's chats go with it (docs/features/chats.md).
export function tombstoneChats(
  records: RecordsRepository,
  accountId: AccountId,
  owner: Exclude<ChatOwner, { kind: "library" }>,
): Promise<number> {
  return tombstoneLiveRecords(records, accountId, "chat", `${chatOwnerPrefix(owner)}%`);
}
