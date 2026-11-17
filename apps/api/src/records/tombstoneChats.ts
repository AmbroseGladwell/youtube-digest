import { chatRecordId } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import type { RecordsRepository } from "./RecordsRepository.js";
import { tombstoneLiveRecords } from "./tombstoneLiveRecords.js";

// An overview's chats go with it (docs/features/chats.md).
export function tombstoneChats(records: RecordsRepository, accountId: AccountId, overviewId: string): Promise<number> {
  return tombstoneLiveRecords(records, accountId, "chat", chatRecordId(overviewId, "%"));
}
