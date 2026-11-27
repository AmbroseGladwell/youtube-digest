import { isSuggestedQuestionLive, type SuggestedQuestion } from "@overview/domain";
import { scopeKeyOf } from "./allocateQuestionSlots.js";

export const UNSEEN_QUESTIONS_WAITING = 3;

export const unseenQuestionsWaiting = (questions: readonly SuggestedQuestion[], scopeKey: string): number =>
  questions.filter(
    (question) =>
      scopeKeyOf(question.scope) === scopeKey &&
      isSuggestedQuestionLive(question) &&
      question.askedAt === null &&
      question.shownAt === null,
  ).length;
