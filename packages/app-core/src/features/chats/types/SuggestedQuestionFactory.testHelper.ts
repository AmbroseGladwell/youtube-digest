import { OverviewId, sortedOverviewIds, suggestedQuestionId, type SuggestedQuestion } from "@overview/domain";

export const makeSuggestedQuestion = (overrides: Partial<SuggestedQuestion> = {}): SuggestedQuestion => {
  const scope = overrides.scope ?? { kind: "library" };
  const overviewIds = sortedOverviewIds(
    overrides.overviewIds ?? [OverviewId.parse(crypto.randomUUID()), OverviewId.parse(crypto.randomUUID())],
  ) as [OverviewId, OverviewId];
  return {
    id: suggestedQuestionId(scope, overviewIds, crypto.randomUUID()),
    scope,
    overviewIds,
    text: "Where do these two disagree about sleep?",
    madeAt: "2026-11-20T09:00:00.000Z",
    shownAt: null,
    askedAt: null,
    dismissedAt: null,
    feedback: null,
    ...overrides,
  };
};
