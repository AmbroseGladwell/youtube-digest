import type { Chat, ChatOwner } from "./Chat.js";

// The server writes chats; the reader can only delete one (docs/features/chats.md).
export interface ChatStore {
  // Oldest first.
  listChats(owner: ChatOwner): Promise<Chat[]>;
  // Oldest first.
  listEveryChat(): Promise<Chat[]>;
  getChat(id: string): Promise<Chat | null>;
  deleteChat(id: string): Promise<void>;
}
