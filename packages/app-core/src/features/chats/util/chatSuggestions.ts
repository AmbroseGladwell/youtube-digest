import { FOLLOW_UP_QUESTIONS_SHOWN, type ChatMessage, type FollowUpQuestion } from "@overview/domain";

export const SUGGESTIONS_AFTER_AN_ANSWER = 2;

// The overview's questions above the chat's field (design 310i): the set of three on show
// before the first answer, then up to two not yet asked in this conversation.
export function chatSuggestions(questions: readonly FollowUpQuestion[], set: number, messages: readonly ChatMessage[]): string[] {
  const asked = new Set(messages.filter((message) => message.from === "reader").map((message) => message.text));
  if (!messages.some((message) => message.from === "answer"))
    return questions.slice(set * FOLLOW_UP_QUESTIONS_SHOWN, (set + 1) * FOLLOW_UP_QUESTIONS_SHOWN).map(({ question }) => question);
  return questions
    .map(({ question }) => question)
    .filter((question) => !asked.has(question))
    .slice(0, SUGGESTIONS_AFTER_AN_ANSWER);
}
