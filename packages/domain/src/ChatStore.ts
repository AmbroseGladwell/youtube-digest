import type { Chat, ChatOwner } from "./Chat.js";

// The reader's side of chats. The server writes them and they arrive through sync; the
// reader can only delete one (docs/features/chats.md).
export interface ChatStore {
  // An owner's chats, or the library's for the library owner, oldest first.
  listChats(owner: ChatOwner): Promise<Chat[]>;
  getChat(id: string): Promise<Chat | null>;
  deleteChat(id: string): Promise<void>;
}
