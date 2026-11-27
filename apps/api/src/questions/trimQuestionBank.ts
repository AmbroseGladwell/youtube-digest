import { isSuggestedQuestionLive, type SuggestedQuestion } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import type { RecordsRepository } from "../records/RecordsRepository.js";
import { scopeKeyOf } from "./allocateQuestionSlots.js";

export const LIBRARY_QUESTION_BANK_MAX = 12;
export const PROJECT_QUESTION_BANK_MAX = 8;

const isBanked = (question: SuggestedQuestion): boolean => isSuggestedQuestionLive(question) && question.askedAt === null;

const newestFirst = (x: SuggestedQuestion, y: SuggestedQuestion): number => y.madeAt.localeCompare(x.madeAt) || x.id.localeCompare(y.id);

// The bank the Ask page pages through, oldest out past its max: docs/features/suggested-questions.md, "The bank".
export const questionsPastBank = (questions: readonly SuggestedQuestion[], scopeKeys: ReadonlySet<string>): SuggestedQuestion[] => {
  const byScope = new Map<string, SuggestedQuestion[]>();
  for (const question of questions.filter(isBanked)) {
    const key = scopeKeyOf(question.scope);
    if (scopeKeys.has(key)) {
      byScope.set(key, [...(byScope.get(key) ?? []), question]);
    }
  }
  return [...byScope.values()].flatMap((banked) => {
    const max = banked[0]!.scope.kind === "library" ? LIBRARY_QUESTION_BANK_MAX : PROJECT_QUESTION_BANK_MAX;
    return [...banked].sort(newestFirst).slice(max);
  });
};

export const trimQuestionBank = async (
  records: RecordsRepository,
  accountId: AccountId,
  questions: readonly SuggestedQuestion[],
  scopeKeys: ReadonlySet<string>,
): Promise<number> => {
  const past = questionsPastBank(questions, scopeKeys);
  if (past.length === 0) {
    return 0;
  }
  const written = await records.write(
    accountId,
    past.map((question) => ({
      kind: "suggestedQuestion" as const,
      id: question.id,
      decide: (current) => (current !== null && !current.deleted ? { action: "tombstone" as const } : { action: "nothing" as const }),
    })),
  );
  return written.filter((outcome) => outcome !== null).length;
};
