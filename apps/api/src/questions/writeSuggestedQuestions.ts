import { randomUUID } from "node:crypto";
import {
  CURRENT_SCHEMA_VERSIONS,
  PROJECT_MEMBER_MIGRATIONS,
  ProjectMember,
  SuggestedQuestion,
  isInProject,
  projectMemberId,
  readStoredRecord,
  sortedOverviewIds,
  stampSchemaVersion,
  suggestedQuestionId,
  type SuggestedQuestionScope,
} from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import { decideReplace } from "../records/decideReplace.js";
import type { RecordsRepository, WriteOperation, WriteOutcome } from "../records/RecordsRepository.js";
import type { StoredRecord } from "../records/StoredRecord.js";
import { serverClientContext } from "../versions/serverClientContext.js";

export interface NewSuggestedQuestion {
  scope: SuggestedQuestionScope;
  overviewIds: readonly [string, string];
  text: string;
}

const isLive = (record: StoredRecord | null | undefined): boolean => record != null && !record.deleted;

const isLiveMember = (record: StoredRecord | null | undefined): boolean => {
  if (record == null || record.deleted) {
    return false;
  }
  const read = readStoredRecord(stampSchemaVersion(record.body ?? {}, record.schemaVersion), ProjectMember, PROJECT_MEMBER_MIGRATIONS);
  return read.status === "read" && isInProject(read.record);
};

const requiredFor = ({ scope, overviewIds }: NewSuggestedQuestion): NonNullable<WriteOperation["requires"]> => [
  ...overviewIds.map((id) => ({ kind: "overview" as const, id })),
  ...(scope.kind === "project"
    ? [
        { kind: "project" as const, id: scope.projectId },
        ...overviewIds.map((overviewId) => ({ kind: "projectMember" as const, id: projectMemberId(scope.projectId, overviewId) })),
      ]
    : []),
];

const standsOn = (scope: SuggestedQuestionScope, [first, second, project, ...members]: Array<StoredRecord | null>): boolean =>
  isLive(first) && isLive(second) && (scope.kind === "library" || (isLive(project) && members.every(isLiveMember)));

const writeOf = (question: NewSuggestedQuestion, at: string): WriteOperation | null => {
  const overviewIds = sortedOverviewIds(question.overviewIds);
  const id = suggestedQuestionId(question.scope, overviewIds, randomUUID());
  const body = {
    id,
    scope: question.scope,
    overviewIds,
    text: question.text,
    madeAt: at,
    shownAt: null,
    askedAt: null,
    dismissedAt: null,
    feedback: null,
  };
  if (!SuggestedQuestion.safeParse(body).success) {
    return null;
  }
  return {
    kind: "suggestedQuestion",
    id,
    requires: requiredFor(question),
    decide: (current, _held, required) => {
      if (current !== null || !standsOn(question.scope, required)) {
        return { action: "nothing" };
      }
      const schemaVersion = CURRENT_SCHEMA_VERSIONS.suggestedQuestion;
      return decideReplace("suggestedQuestion", current, { body, schemaVersion, updatedAt: at, ifMatch: null }, serverClientContext);
    },
  };
};

// One that no longer stands is skipped, never the batch: docs/features/suggested-questions.md, "The server writes it".
export const writeSuggestedQuestions = async (
  records: RecordsRepository,
  accountId: AccountId,
  questions: readonly NewSuggestedQuestion[],
  now: Date,
): Promise<Array<WriteOutcome | null>> => {
  const at = now.toISOString();
  const writes = questions.map((question) => writeOf(question, at));
  const operations = writes.filter((write): write is WriteOperation => write !== null);
  const written = operations.length === 0 ? [] : await records.write(accountId, operations);
  const outcomes = new Map(operations.map((operation, index) => [operation, written[index] ?? null]));
  return writes.map((write) => (write === null ? null : (outcomes.get(write) ?? null)));
};
