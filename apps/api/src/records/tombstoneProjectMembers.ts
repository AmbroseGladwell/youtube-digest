import type { AccountId } from "../auth/AccountId.js";
import type { RecordsRepository } from "./RecordsRepository.js";
import { tombstoneLiveRecords } from "./tombstoneLiveRecords.js";

export type MembersOf = { projectId: string } | { overviewId: string };

const patternFor = (of: MembersOf): string => ("projectId" in of ? `${of.projectId}:%` : `%:${of.overviewId}`);

export const tombstoneProjectMembers = (records: RecordsRepository, accountId: AccountId, of: MembersOf): Promise<number> => {
  return tombstoneLiveRecords(records, accountId, "projectMember", patternFor(of));
};
