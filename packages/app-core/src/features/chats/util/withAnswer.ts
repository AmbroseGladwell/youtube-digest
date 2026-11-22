import type { Chat, ChatMessage } from "@overview/domain";

export const withAnswer = (
  chats: readonly Chat[],
  owner: Pick<Chat, "overviewId" | "projectId">,
  chatId: string,
  messages: readonly ChatMessage[],
): Chat[] => {
  const current = chats.find((chat) => chat.id === chatId);
  if (current === undefined) {
    return [...chats, { id: chatId, ...owner, startedAt: messages[0]?.at ?? new Date(0).toISOString(), messages: [...messages] }];
  }
  const known = new Set(current.messages.map((message) => `${message.from}|${message.at}|${message.text}`));
  const added = messages.filter((message) => !known.has(`${message.from}|${message.at}|${message.text}`));
  return chats.map((chat) => (chat === current ? { ...chat, messages: [...chat.messages, ...added] } : chat));
};
