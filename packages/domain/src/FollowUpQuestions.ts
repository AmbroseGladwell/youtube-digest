import { z } from "zod";
import { wordCount } from "./wordCount.js";

export const MOST_FOLLOW_UP_QUESTIONS = 9;
export const FOLLOW_UP_QUESTIONS_SHOWN = 3;
export const MOST_READER_QUESTIONS = MOST_FOLLOW_UP_QUESTIONS / FOLLOW_UP_QUESTIONS_SHOWN;
export const FOLLOW_UP_QUESTION_TARGET_WORDS = 15;
export const FOLLOW_UP_QUESTION_MAX_WORDS = 25;

export const FollowUpQuestion = z.object({
  question: z
    .string()
    .min(1)
    .refine(
      (question) => wordCount(question) <= FOLLOW_UP_QUESTION_MAX_WORDS,
      `docs/features/follow-up-questions.md: max ${FOLLOW_UP_QUESTION_MAX_WORDS} words`,
    ),
  forReader: z.boolean(),
});
export type FollowUpQuestion = z.infer<typeof FollowUpQuestion>;

export const FollowUpQuestions = z
  .array(FollowUpQuestion)
  .max(MOST_FOLLOW_UP_QUESTIONS)
  .refine(
    (questions) =>
      Array.from({ length: Math.ceil(questions.length / FOLLOW_UP_QUESTIONS_SHOWN) }).every(
        (_, set) =>
          questions.slice(set * FOLLOW_UP_QUESTIONS_SHOWN, (set + 1) * FOLLOW_UP_QUESTIONS_SHOWN).filter((question) => question.forReader)
            .length <= 1,
      ),
    `docs/features/follow-up-questions.md: at most one reader question in each ${FOLLOW_UP_QUESTIONS_SHOWN}`,
  );
export type FollowUpQuestions = z.infer<typeof FollowUpQuestions>;
