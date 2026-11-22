import { FOLLOW_UP_QUESTIONS_SHOWN, type ChatMessage, type FollowUpQuestion } from "@overview/domain";

// The overview's questions above the chat's field (design 310i, OV-323): the set of three on show,
// only until the conversation's first question.
export function chatSuggestions(questions: readonly FollowUpQuestion[], set: number, messages: readonly ChatMessage[]): string[] {
  if (messages.some((message) => message.from === "reader")) {
    return [];
  }
  return questions.slice(set * FOLLOW_UP_QUESTIONS_SHOWN, (set + 1) * FOLLOW_UP_QUESTIONS_SHOWN).map(({ question }) => question);
}
