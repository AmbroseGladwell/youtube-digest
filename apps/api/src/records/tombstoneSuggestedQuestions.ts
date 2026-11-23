import type { AccountId } from "../auth/AccountId.js";
import type { RecordsRepository } from "./RecordsRepository.js";
import { tombstoneLiveRecords } from "./tombstoneLiveRecords.js";

export type SuggestedQuestionsOf = { overviewId: string } | { projectId: string } | { projectId: string; overviewId: string };

// Ids are colon-joined uuids, so a colon on each side matches only that overview.
const patternFor = (of: SuggestedQuestionsOf): string => {
  if ("projectId" in of && "overviewId" in of) {
    return `project:${of.projectId}:%${of.overviewId}:%`;
  }
  return "projectId" in of ? `project:${of.projectId}:%` : `%:${of.overviewId}:%`;
};

export const tombstoneSuggestedQuestions = (
  records: RecordsRepository,
  accountId: AccountId,
  of: SuggestedQuestionsOf,
): Promise<number> => {
  return tombstoneLiveRecords(records, accountId, "suggestedQuestion", patternFor(of));
};
