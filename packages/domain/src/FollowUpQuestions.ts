import { z } from "zod";
import { wordCount } from "./wordCount.js";

export const MOST_FOLLOW_UP_QUESTIONS = 9;
export const FOLLOW_UP_QUESTIONS_SHOWN = 3;
export const FOLLOW_UP_QUESTION_TARGET_WORDS = 15;
export const FOLLOW_UP_QUESTION_MAX_WORDS = 25;

export const FollowUpQuestion = z
  .string()
  .min(1)
  .refine(
    (question) => wordCount(question) <= FOLLOW_UP_QUESTION_MAX_WORDS,
    `docs/features/follow-up-questions.md: max ${FOLLOW_UP_QUESTION_MAX_WORDS} words`,
  );

export const FollowUpQuestions = z.array(FollowUpQuestion).max(MOST_FOLLOW_UP_QUESTIONS);
export type FollowUpQuestions = z.infer<typeof FollowUpQuestions>;
