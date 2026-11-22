import { z } from "zod";
import { FollowUpAssistant } from "./FollowUpAssistant.js";
import { MOST_FOLLOW_UP_QUESTIONS } from "./FollowUpQuestions.js";

// Keyed by words, so a rewritten overview's questions start unasked: docs/features/follow-up-questions.md.
export const AskedQuestion = z.object({
  question: z.string().min(1),
  assistant: FollowUpAssistant,
  askedAt: z.string().datetime(),
});
export type AskedQuestion = z.infer<typeof AskedQuestion>;

export const AskedQuestions = z.array(AskedQuestion).max(MOST_FOLLOW_UP_QUESTIONS);
export type AskedQuestions = z.infer<typeof AskedQuestions>;

// Only questions still on the overview, so the list never outgrows them.
export const recordAskedQuestion = (asked: readonly AskedQuestion[], ask: AskedQuestion, questions: readonly string[]): AskedQuestion[] => {
  return [...asked.filter(({ question }) => question !== ask.question), ask].filter(({ question }) => questions.includes(question));
};

export const foldAskedQuestions = (winner: readonly AskedQuestion[], loser: readonly AskedQuestion[]): AskedQuestion[] => {
  const latest = new Map<string, AskedQuestion>();
  for (const ask of [...winner, ...loser]) {
    const held = latest.get(ask.question);
    if (held === undefined || ask.askedAt > held.askedAt) {
      latest.set(ask.question, ask);
    }
  }
  return [...latest.values()].slice(0, MOST_FOLLOW_UP_QUESTIONS);
};
