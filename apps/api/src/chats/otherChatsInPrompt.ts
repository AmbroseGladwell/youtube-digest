import type { Chat, ChatCitation } from "@overview/domain";

// About 6,000 tokens: a bound on what each question costs however much the reader has chatted.
export const OTHER_CHATS_BUDGET_CHARACTERS = 24_000;

export interface OtherChatsInPrompt {
  conversations: Array<{
    label: string;
    startedAt: string;
    lines: Array<{ label: string; from: "reader" | "answer"; text: string }>;
  }>;
  labels: ReadonlyMap<string, Extract<ChatCitation, { chatId: string }>>;
  messages: number;
}

// Why newest kept first: docs/features/chats.md, "Several chats, and one using another".
export const otherChatsInPrompt = (others: readonly Chat[], budget = OTHER_CHATS_BUDGET_CHARACTERS): OtherChatsInPrompt => {
  const chats = [...others].sort((left, right) => left.startedAt.localeCompare(right.startedAt));
  const all = chats.flatMap((chat, chatIndex) => chat.messages.map((message, index) => ({ chatIndex, index, message })));
  const newestFirst = [...all].sort((left, right) => right.message.at.localeCompare(left.message.at) || right.index - left.index);
  const kept = new Set<string>();
  let spent = 0;
  for (const { chatIndex, index, message } of newestFirst) {
    if (spent + message.text.length > budget) {
      break;
    }
    spent += message.text.length;
    kept.add(`${chatIndex}:${index}`);
  }

  const labels = new Map<string, Extract<ChatCitation, { chatId: string }>>();
  const conversations: OtherChatsInPrompt["conversations"] = [];
  for (const [chatIndex, chat] of chats.entries()) {
    const lines = chat.messages.flatMap((message, index) => {
      if (!kept.has(`${chatIndex}:${index}`)) {
        return [];
      }
      const label = `c${conversations.length + 1}.m${index + 1}`;
      labels.set(label, { chatId: chat.id, message: index });
      return [{ label, from: message.from, text: message.text }];
    });
    if (lines.length > 0) {
      conversations.push({ label: `c${conversations.length + 1}`, startedAt: chat.startedAt, lines });
    }
  }
  return { conversations, labels, messages: kept.size };
};
