import { FOLLOW_UP_QUESTION_MAX_WORDS, FOLLOW_UP_QUESTION_TARGET_WORDS } from "@overview/domain";
import { z } from "zod";
import type { ReplyShape } from "../chats/streamChatCompletion.js";

export const WrittenQuestions = z.object({
  questions: z.array(z.object({ pair: z.number(), question: z.string(), rating: z.number() })),
});
export type WrittenQuestions = z.infer<typeof WrittenQuestions>;

export const QUESTION_RATING_MAX = 5;
export const MIN_QUESTION_RATING = 4;

const WRITER_TOKENS = 4_000;

export const WRITTEN_QUESTIONS_SHAPE: Omit<ReplyShape, "model"> = {
  name: "written_questions",
  maxTokens: WRITER_TOKENS,
  schema: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: { pair: { type: "integer" }, question: { type: "string" }, rating: { type: "integer" } },
          required: ["pair", "question", "rating"],
          additionalProperties: false,
        },
      },
    },
    required: ["questions"],
    additionalProperties: false,
  },
};

export interface QuestionWriterContext {
  obvious: readonly string[];
  onShow: readonly string[];
}

const bulleted = (lines: readonly string[]) => lines.map((line) => `- ${line}`).join("\n");

// The harness's QUESTION_PROMPT, plus both overviews and the reader's own marks: docs/features/suggested-questions.md, "Writing".
export const questionWriterPrompt = ({ obvious, onShow }: QuestionWriterContext): string =>
  [
    `You suggest questions a reader could ask about their own library of overviews of videos, articles and podcasts. Each question rests on a pair of overviews whose ideas connect, and is meant to make the reader glad they kept both. You see what is known about the reader, their projects, then numbered pairs, each marked with where the question will be shown: their whole library, or one project's chat. Only the best of what you write will be shown.

Write at most one question for each pair, and rate it. Skip any pair whose only question is obvious: fewer is better than weak.

A good question:
- asks about something neither overview settles alone: advice that clashes and what decides between it, a rule from one subject that might carry over to another, or a concrete decision it opens up.
- draws on both overviews of its pair. A question that could be asked of one of them alone is not a good one.
- for a project, points at a decision in that project's purpose.
- stands alone: it names the two ideas in plain words, and any term in it is clear without looking it up.
- is one sentence, about ${FOLLOW_UP_QUESTION_TARGET_WORDS} words and never more than ${FOLLOW_UP_QUESTION_MAX_WORDS}, and is a real question the reader would type into a chat. Name each idea in a few words; leave the detail to the answer.
An obvious question asks about a theme the two share, well-known advice, or whether one thing needs another done well.`,
    obvious.length === 0 ? "" : `The reader found questions like these obvious:\n${bulleted(obvious)}`,
    onShow.length === 0 ? "" : `These questions are already on show. Don't repeat their themes:\n${bulleted(onShow)}`,
    `pair: the number of the pair the question rests on.
rating: how glad this reader would be to ask it, from 1 to ${QUESTION_RATING_MAX}. Be strict, and rate each on its own.
- 5: they would want to ask it now. It opens something neither overview settles, and fits what they care about or are working on.
- 4: a question they would be glad to find, though not pressing.
- 3: reasonable, but the kind of question they would expect.
- 2: close to obvious, or leans on one overview.
- 1: weak.`,
  ]
    .filter((part) => part !== "")
    .join("\n\n");
