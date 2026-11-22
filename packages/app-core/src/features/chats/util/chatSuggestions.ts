import { FOLLOW_UP_QUESTIONS_SHOWN, type ChatMessage, type FollowUpQuestion } from "@overview/domain";

export const chatSuggestions = (questions: readonly FollowUpQuestion[], set: number, messages: readonly ChatMessage[]): string[] => {
  if (messages.some((message) => message.from === "reader")) {
    return [];
  }
  return questions.slice(set * FOLLOW_UP_QUESTIONS_SHOWN, (set + 1) * FOLLOW_UP_QUESTIONS_SHOWN).map(({ question }) => question);
};
