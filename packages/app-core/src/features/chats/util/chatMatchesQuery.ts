import type { Chat } from "@overview/domain";

const words = (text: string): string[] => text.toLocaleLowerCase("en-GB").split(/\s+/).filter(Boolean);

export const chatMatchesQuery = (chat: Chat, query: string, alsoSearched: string = ""): boolean => {
  const sought = words(query);
  if (sought.length === 0) {
    return true;
  }
  const questions = chat.messages.filter((message) => message.from === "reader").map((message) => message.text);
  const haystack = [...questions, alsoSearched].join(" ").toLocaleLowerCase("en-GB");
  return sought.every((word) => haystack.includes(word));
};
