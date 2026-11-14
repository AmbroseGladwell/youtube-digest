import {
  FOLLOW_UP_QUESTION_MAX_WORDS,
  FOLLOW_UP_QUESTION_TARGET_WORDS,
  FOLLOW_UP_QUESTIONS_SHOWN,
  MOST_FOLLOW_UP_QUESTIONS,
  wordCount,
  type FollowUpQuestions,
} from "@overview/domain";
import { z } from "zod";
import type { PromptSection } from "../PromptSection.js";

export type QuestionedSource = "video" | "article" | "recipe";

const GOOD: Record<QuestionedSource, string> = {
  video: `"Why does the keeper test ask who a manager would fight to keep, rather than who to let go?"
"What goes wrong when a team treats a shipped feature as a finished one?"`,
  article: `"Why does the keeper test ask who a manager would fight to keep, rather than who to let go?"
"What goes wrong when a team treats a shipped feature as a finished one?"`,
  recipe: `"Why does frying the tomato paste until it darkens deepen the flavour of the rice?"
"How does washing the rice first change the texture of the finished dish?"`,
};

const FIT = `Let the reader shape the questions. Prefer the ideas that bear most on
their work, interests and what they are trying to do, and make one
question in each ${FOLLOW_UP_QUESTIONS_SHOWN} ask from where they stand, linking an idea to
something they already do. Never give them a new project, role or
occasion just to hang a question on.`;

const readerFit = (readerContext: string | null, describedAbove: boolean): string => {
  if (readerContext === null) return "";
  return describedAbove
    ? `\n\n${FIT} The reader is described under How to apply.`
    : `\n\nAbout the reader, for fit: ${readerContext}\n\n${FIT}`;
};

export const followUpQuestionsInstructions = (source: QuestionedSource, readerContext: string | null, describedAbove: boolean) => `
## Questions to ask next
Up to ${MOST_FOLLOW_UP_QUESTIONS} questions I could ask an assistant to understand this ${source}
better. Each takes one specific idea, term or technique from the ${source}
and asks why it matters, how it works, or what goes wrong without it.
These are for learning, not for checking whether the ${source} is right.
Take each from the note's key points or chapters, so the question can be
answered from the note.

They are shown ${FOLLOW_UP_QUESTIONS_SHOWN} at a time, in your order, so put the ones most worth
asking first, and give the ${FOLLOW_UP_QUESTIONS_SHOWN} in each turn ${FOLLOW_UP_QUESTIONS_SHOWN} different ideas. Spread
them across as many of the ${source}'s ideas as you can. When it has too few
ideas for ${MOST_FOLLOW_UP_QUESTIONS} good questions, give fewer: never two questions on the same
idea, and never one just to fill the list.

Each is one sentence, about ${FOLLOW_UP_QUESTION_TARGET_WORDS} words. Never ask what the note
already answers in full, and never a generic question such as "Tell me
more" or "What are the main takeaways?". Each question is read on its
own, away from the note, so name the idea it is about rather than saying
"this" or "the ${source}".
Good: ${GOOD[source]}
Bad: "What else does it say?"${readerFit(readerContext, describedAbove)}`;

export const followUpQuestionsShape = () => ({
  followUpQuestions: z.string().array(),
});

export const resolvedFollowUpQuestions = (written: string[]): FollowUpQuestions =>
  written
    .map((question) => question.trim())
    .filter((question) => question !== "" && wordCount(question) <= FOLLOW_UP_QUESTION_MAX_WORDS)
    .slice(0, MOST_FOLLOW_UP_QUESTIONS);

export const followUpQuestionsSection: PromptSection = {
  title: "Questions to ask next",
  key: "structural",
  prompt: (input) => followUpQuestionsInstructions("video", input.readerContext, input.sectionsEnabled.howToApply),
  schemaShape: followUpQuestionsShape,
};

export const recipeFollowUpQuestionsSection: PromptSection = {
  ...followUpQuestionsSection,
  prompt: (input) => followUpQuestionsInstructions("recipe", input.readerContext, false),
};
