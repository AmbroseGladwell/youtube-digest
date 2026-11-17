import type { OverviewId } from "./Brands.js";
import type { Chat } from "./Chat.js";

// The reader's side of chats. The server writes them and they arrive through sync; the
// reader can only delete one (docs/features/chats.md).
export interface ChatStore {
  // Oldest first.
  listChats(overviewId: OverviewId): Promise<Chat[]>;
  getChat(id: string): Promise<Chat | null>;
  deleteChat(id: string): Promise<void>;
}
