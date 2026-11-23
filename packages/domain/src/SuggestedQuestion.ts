import { z } from "zod";
import { OverviewId, ProjectId } from "./Brands.js";
import { chatOwnerPrefix } from "./Chat.js";
import { FOLLOW_UP_QUESTION_MAX_WORDS } from "./FollowUpQuestions.js";
import { wordCount } from "./wordCount.js";

export const SUGGESTED_QUESTION_MAX_LENGTH = 300;

export const SuggestedQuestionScope = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("library") }).strict(),
  z.object({ kind: z.literal("project"), projectId: ProjectId }).strict(),
]);
export type SuggestedQuestionScope = z.infer<typeof SuggestedQuestionScope>;

export const SuggestedQuestionVerdict = z.enum(["glad", "obvious"]);
export type SuggestedQuestionVerdict = z.infer<typeof SuggestedQuestionVerdict>;

export const SuggestedQuestionFeedback = z.object({ verdict: SuggestedQuestionVerdict, at: z.iso.datetime() }).strict();
export type SuggestedQuestionFeedback = z.infer<typeof SuggestedQuestionFeedback>;

export const SuggestedQuestionText = z
  .string()
  .min(1)
  .max(SUGGESTED_QUESTION_MAX_LENGTH)
  .refine((text) => wordCount(text) <= FOLLOW_UP_QUESTION_MAX_WORDS, `at most ${FOLLOW_UP_QUESTION_MAX_WORDS} words`);

export const SuggestedQuestionOverviewIds = z
  .tuple([OverviewId, OverviewId])
  .refine(([first, second]) => first !== second, { message: "a question rests on two different overviews" });

// Reader state apart from the overviews, written by the server (docs/features/suggested-questions.md).
export const SuggestedQuestion = z.object({
  id: z.string().min(1),
  scope: SuggestedQuestionScope,
  overviewIds: SuggestedQuestionOverviewIds,
  text: SuggestedQuestionText,
  madeAt: z.iso.datetime(),
  shownAt: z.iso.datetime().nullable(),
  askedAt: z.iso.datetime().nullable(),
  dismissedAt: z.iso.datetime().nullable(),
  feedback: SuggestedQuestionFeedback.nullable(),
});
export type SuggestedQuestion = z.infer<typeof SuggestedQuestion>;

// Never text, scope, overviews or madeAt: those are the server's.
export const SuggestedQuestionChange = z
  .object({
    shownAt: z.iso.datetime().optional(),
    askedAt: z.iso.datetime().optional(),
    dismissedAt: z.iso.datetime().optional(),
    feedback: SuggestedQuestionFeedback.optional(),
  })
  .strict()
  .refine((change) => Object.values(change).some((value) => value !== undefined), { message: "a change to a question changes something" });
export type SuggestedQuestionChange = z.infer<typeof SuggestedQuestionChange>;

export const suggestedQuestionScopePrefix = (scope: SuggestedQuestionScope): string =>
  chatOwnerPrefix(scope.kind === "project" ? { kind: "project", id: scope.projectId } : { kind: "library" });

export const sortedOverviewIds = (overviewIds: readonly [string, string]): [string, string] => {
  const [first, second] = [...overviewIds].sort();
  return [first!, second!];
};

export const suggestedQuestionId = (scope: SuggestedQuestionScope, overviewIds: readonly [string, string], questionId: string): string =>
  `${suggestedQuestionScopePrefix(scope)}${sortedOverviewIds(overviewIds).join(":")}:${questionId}`;

export const isSuggestedQuestionLive = (question: Pick<SuggestedQuestion, "dismissedAt" | "feedback">): boolean =>
  question.dismissedAt === null && question.feedback?.verdict !== "obvious";

const timeOf = (value: unknown): number => (typeof value === "string" ? Date.parse(value) : Number.NaN);

const earlierOf = (base: unknown, change: unknown): unknown => {
  const [b, c] = [timeOf(base), timeOf(change)];
  if (Number.isNaN(c)) {
    return base ?? null;
  }
  return Number.isNaN(b) || c < b ? change : base;
};

const VERDICT_RANK: Record<string, number> = { glad: 0, obvious: 1 };

const rankOf = (feedback: unknown): [number, number] => {
  const { verdict, at } = (feedback ?? {}) as { verdict?: unknown; at?: unknown };
  return [timeOf(at), typeof verdict === "string" ? (VERDICT_RANK[verdict] ?? -1) : -1];
};

// Ties go to obvious, so the order changes arrive in never decides it.
const laterFeedbackOf = (base: unknown, change: unknown): unknown => {
  const [[bAt, bVerdict], [cAt, cVerdict]] = [rankOf(base), rankOf(change)];
  if (Number.isNaN(cAt)) {
    return base ?? null;
  }
  return Number.isNaN(bAt) || cAt > bAt || (cAt === bAt && cVerdict > bVerdict) ? change : base;
};

const ONCE_FIELDS = ["shownAt", "askedAt", "dismissedAt"] as const;

// Shared by the store, the server and the rebase, and it commutes (docs/features/suggested-questions.md).
export const mergeSuggestedQuestion = (base: Record<string, unknown>, change: Record<string, unknown>): Record<string, unknown> => {
  const once = Object.fromEntries(ONCE_FIELDS.map((field) => [field, earlierOf(base[field], change[field])]));
  return { ...base, ...once, feedback: laterFeedbackOf(base.feedback, change.feedback) };
};
