import {
  FOLLOW_UP_QUESTION_MAX_WORDS,
  FOLLOW_UP_QUESTION_TARGET_WORDS,
  FOLLOW_UP_QUESTIONS,
  wordCount,
  type FollowUpQuestions,
} from "@overview/domain";
import { z } from "zod";
import type { PromptSection } from "../PromptSection.js";

export type QuestionedSource = "video" | "article" | "recipe";

const GOOD: Record<QuestionedSource, string> = {
  video: `"Is the keeper test a good idea, or does it leave a team working in fear?"`,
  article: `"Is the keeper test a good idea, or does it leave a team working in fear?"`,
  recipe: `"Could I make this with chickpeas instead of chicken, and what would change?"`,
};

const FIT = `Fit them to what the reader already does and the limits they live with,
the way someone who knows them would ask. Never give them a new project,
role or occasion just to hang a question on.`;

const readerFit = (readerContext: string | null, describedAbove: boolean): string => {
  if (readerContext === null) return "";
  return describedAbove
    ? `\n\n${FIT} The reader is described under How to apply.`
    : `\n\nAbout the reader, for fit: ${readerContext}\n\n${FIT}`;
};

export const followUpQuestionsInstructions = (source: QuestionedSource, readerContext: string | null, describedAbove: boolean) => `
## Questions to ask next
${FOLLOW_UP_QUESTIONS} questions I could take to an assistant to go further with this ${source}.
Each is one sentence, about ${FOLLOW_UP_QUESTION_TARGET_WORDS} words. Ask what the ${source} raises
but leaves open, what would test whether it holds up, or how it would
work in my own life. Never ask what the note already answers, and never a
generic question such as "Tell me more" or "What are the main takeaways?".
Each question is read on its own, away from the note, so name the idea it
is about rather than saying "this" or "the ${source}".
Good: ${GOOD[source]}
Bad: "What else does it say?"${readerFit(readerContext, describedAbove)}`;

export const followUpQuestionsShape = () => ({
  followUpQuestions: z.string().array(),
});

export const resolvedFollowUpQuestions = (written: string[]): FollowUpQuestions =>
  written
    .map((question) => question.trim())
    .filter((question) => question !== "" && wordCount(question) <= FOLLOW_UP_QUESTION_MAX_WORDS)
    .slice(0, FOLLOW_UP_QUESTIONS);

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
