import type { SuggestedQuestion } from "@overview/domain";

export const REFRESH_GAP_DAYS = 2;
export const IDLE_REFRESHES_BEFORE_BACKOFF = 2;
export const BACKOFF_GAP_MAX_DAYS = 14;

// Asked, Good question, Hide and Not useful all count: docs/features/suggested-questions.md, "Backing off".
export const lastEngagedAt = (questions: readonly SuggestedQuestion[]): string | null =>
  questions
    .flatMap((question) => [question.askedAt, question.dismissedAt, question.feedback?.at ?? null])
    .filter((at): at is string => at !== null)
    .reduce<string | null>((latest, at) => (latest === null || Date.parse(at) > Date.parse(latest) ? at : latest), null);

export const refreshGapDays = (idleRefreshes: number): number =>
  idleRefreshes < IDLE_REFRESHES_BEFORE_BACKOFF
    ? REFRESH_GAP_DAYS
    : Math.min(BACKOFF_GAP_MAX_DAYS, REFRESH_GAP_DAYS * 2 ** (idleRefreshes - IDLE_REFRESHES_BEFORE_BACKOFF + 1));
