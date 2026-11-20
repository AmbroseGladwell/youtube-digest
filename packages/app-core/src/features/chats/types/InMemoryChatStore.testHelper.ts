import { chatOwner, type Chat, type ChatOwner, type ChatStore } from "@overview/domain";

export class InMemoryChatStore implements ChatStore {
  #chats = new Map<string, Chat>();

  seedChat(chat: Chat) {
    this.#chats.set(chat.id, chat);
  }

  async listChats(owner: ChatOwner) {
    const keyOf = (of: ChatOwner) => (of.kind === "library" ? "library" : `${of.kind}:${of.id}`);
    return [...this.#chats.values()]
      .filter((chat) => keyOf(chatOwner(chat)) === keyOf(owner))
      .sort((left, right) => left.startedAt.localeCompare(right.startedAt));
  }

  async getChat(id: string) {
    return this.#chats.get(id) ?? null;
  }

  async deleteChat(id: string) {
    this.#chats.delete(id);
  }
}
