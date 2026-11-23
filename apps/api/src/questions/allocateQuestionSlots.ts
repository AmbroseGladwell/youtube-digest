import type { SuggestedQuestion, SuggestedQuestionScope } from "@overview/domain";
import { libraryScopeKey, projectScopeKey } from "./QuestionRefreshesRepository.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export const SHOWN_QUESTION_LASTS_DAYS = 3;
export const UNUSED_LIBRARY_QUESTIONS_MAX = 6;
export const UNUSED_PROJECT_QUESTIONS_MAX = 4;
export const NEW_QUESTIONS_PER_REFRESH = 6;
export const NEW_LIBRARY_QUESTIONS_MAX = 3;
export const NEW_PROJECT_QUESTIONS_MAX = 2;

export interface ScopeSlots {
  scopeKey: string;
  scope: SuggestedQuestionScope;
  slots: number;
}

export const scopeKeyOf = (scope: SuggestedQuestionScope): string =>
  scope.kind === "library" ? libraryScopeKey : projectScopeKey(scope.projectId);

export const isUsedUp = (question: SuggestedQuestion, now: Date): boolean =>
  question.askedAt !== null ||
  question.dismissedAt !== null ||
  question.feedback?.verdict === "obvious" ||
  (question.shownAt !== null && Date.parse(question.shownAt) < now.getTime() - SHOWN_QUESTION_LASTS_DAYS * DAY_MS);

// Library first, then each project in the order given: docs/features/suggested-questions.md, "Slots".
export const allocateQuestionSlots = (
  questions: readonly SuggestedQuestion[],
  projectScopes: readonly SuggestedQuestionScope[],
  now: Date,
): ScopeSlots[] => {
  const unused = new Map<string, number>();
  for (const question of questions) {
    if (!isUsedUp(question, now)) {
      const key = scopeKeyOf(question.scope);
      unused.set(key, (unused.get(key) ?? 0) + 1);
    }
  }
  const allocated: ScopeSlots[] = [];
  let left = NEW_QUESTIONS_PER_REFRESH;
  const offer = (scope: SuggestedQuestionScope, unusedMax: number, newMax: number) => {
    const scopeKey = scopeKeyOf(scope);
    const slots = Math.max(0, Math.min(newMax, unusedMax - (unused.get(scopeKey) ?? 0), left));
    if (slots > 0) {
      allocated.push({ scopeKey, scope, slots });
      left -= slots;
    }
  };
  offer({ kind: "library" }, UNUSED_LIBRARY_QUESTIONS_MAX, NEW_LIBRARY_QUESTIONS_MAX);
  for (const scope of projectScopes) {
    offer(scope, UNUSED_PROJECT_QUESTIONS_MAX, NEW_PROJECT_QUESTIONS_MAX);
  }
  return allocated;
};
