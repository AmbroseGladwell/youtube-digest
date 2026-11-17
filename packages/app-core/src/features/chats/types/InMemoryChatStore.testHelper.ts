import type { Chat, ChatStore, OverviewId } from "@overview/domain";

export class InMemoryChatStore implements ChatStore {
  #chats = new Map<string, Chat>();

  seedChat(chat: Chat) {
    this.#chats.set(chat.id, chat);
  }

  async listChats(overviewId: OverviewId) {
    return [...this.#chats.values()]
      .filter((chat) => chat.overviewId === overviewId)
      .sort((left, right) => left.startedAt.localeCompare(right.startedAt));
  }

  async getChat(id: string) {
    return this.#chats.get(id) ?? null;
  }

  async deleteChat(id: string) {
    this.#chats.delete(id);
  }
}
