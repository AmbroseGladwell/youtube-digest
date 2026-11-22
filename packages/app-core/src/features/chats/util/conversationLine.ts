import type { Chat } from "@overview/domain";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const lastActive = (chat: Chat): string => chat.messages.at(-1)?.at ?? chat.startedAt;

export const questionsIn = (chat: Chat): number => chat.messages.filter((message) => message.from === "reader").length;

export const firstQuestionOf = (chat: Chat): string => chat.messages.find((message) => message.from === "reader")?.text ?? "";

export const conversationDate = (at: string, now: Date): string => {
  const when = new Date(at);
  const day = `${when.getDate()} ${MONTHS[when.getMonth()]}`;
  return when.getFullYear() === now.getFullYear() ? day : `${day} ${when.getFullYear()}`;
};

export const conversationLine = (chat: Chat, now: Date): string => {
  const when = new Date(lastActive(chat));
  const today = when.toDateString() === now.toDateString();
  const time = `${String(when.getHours()).padStart(2, "0")}:${String(when.getMinutes()).padStart(2, "0")}`;
  const count = questionsIn(chat);
  return `${today ? `Today, ${time}` : conversationDate(lastActive(chat), now)} · ${count} ${count === 1 ? "question" : "questions"}`;
};
