import type { Chat, ChatSource } from "@overview/domain";

export interface ConversationSources {
  live: ChatSource[];
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
