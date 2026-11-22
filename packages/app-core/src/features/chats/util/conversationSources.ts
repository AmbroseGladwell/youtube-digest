import type { Chat, ChatSource } from "@overview/domain";

export interface ConversationSources {
  // What the next question sends again: every overview the conversation added, pinned or found,
  // minus any the reader set aside since.
  live: ChatSource[];
  // Search my library as the conversation last left it; on until a question turned it off (OV-354).
  searchLibrary: boolean;
}

export const conversationSources = (chat: Pick<Chat, "messages"> | null): ConversationSources => {
  const asked = (chat?.messages ?? []).flatMap((message) => (message.from === "reader" ? [message] : []));
  const setAside = new Set(asked.flatMap((message) => message.setAside ?? []));
  const live = new Map<string, ChatSource>();
  for (const source of asked.flatMap((message) => message.sources ?? [])) {
    if (setAside.has(source.label)) {
      live.delete(source.overviewId);
    } else {
      live.set(source.overviewId, source);
    }
  }
  const last = asked.at(-1);
  return { live: [...live.values()], searchLibrary: last === undefined ? true : last.searchedLibrary !== false };
};
