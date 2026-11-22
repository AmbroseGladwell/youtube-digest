import { CHAT_MIGRATIONS, Chat, chatOwner, readStoredRecord, type ChatOwner, type ChatStore } from "@overview/domain";
import { appendPendingWrite, JOURNALLED_STORES } from "./appendPendingWrite.js";
import type { IndexedDbStoreOptions } from "./IndexedDbStoreOptions.js";
import { CHATS_BY_OVERVIEW_INDEX, CHATS_BY_PROJECT_INDEX, CHATS_STORE } from "./localDatabaseSchema.js";
import { promisifyRequest } from "./promisifyRequest.js";
import { promisifyTransaction } from "./promisifyTransaction.js";

const readable = (raw: unknown): Chat[] => {
  const read = readStoredRecord(raw, Chat, CHAT_MIGRATIONS);
  return read.status === "read" ? [read.record] : [];
};

// Chats arrive through sync, written by the server; the only thing a device does to one is
// delete it (docs/features/chats.md).
export class IndexedDbChatStore implements ChatStore {
  #db: IDBDatabase;
  #onJournaled: (() => void) | undefined;

  constructor(db: IDBDatabase, { onJournaled }: IndexedDbStoreOptions = {}) {
    this.#db = db;
    this.#onJournaled = onJournaled;
  }

  // The library's chats have no owner, so no index holds them: they are the ones left over.
  async listChats(owner: ChatOwner): Promise<Chat[]> {
    const store = this.#db.transaction(CHATS_STORE, "readonly").objectStore(CHATS_STORE);
    const request =
      owner.kind === "overview"
        ? store.index(CHATS_BY_OVERVIEW_INDEX).getAll(owner.id)
        : owner.kind === "project"
          ? store.index(CHATS_BY_PROJECT_INDEX).getAll(owner.id)
          : store.getAll();
    const chats = (await promisifyRequest<unknown[]>(request))
      .flatMap(readable)
      .filter((chat) => owner.kind !== "library" || chatOwner(chat).kind === "library");
    return chats.sort((left, right) => left.startedAt.localeCompare(right.startedAt));
  }

  async listEveryChat(): Promise<Chat[]> {
    const store = this.#db.transaction(CHATS_STORE, "readonly").objectStore(CHATS_STORE);
    const chats = (await promisifyRequest<unknown[]>(store.getAll())).flatMap(readable);
    return chats.sort((left, right) => left.startedAt.localeCompare(right.startedAt));
  }

  async getChat(id: string): Promise<Chat | null> {
    const store = this.#db.transaction(CHATS_STORE, "readonly").objectStore(CHATS_STORE);
    const raw = await promisifyRequest<unknown>(store.get(id));
    return raw === undefined ? null : (readable(raw)[0] ?? null);
  }

  async deleteChat(id: string): Promise<void> {
    const transaction = this.#db.transaction([CHATS_STORE, ...JOURNALLED_STORES], "readwrite");
    const chats = transaction.objectStore(CHATS_STORE);
    const existing = await promisifyRequest<unknown>(chats.get(id));
    chats.delete(id);
    const journaled =
      existing !== undefined &&
      (await appendPendingWrite(transaction, { kind: "chat", id, updatedAt: new Date().toISOString(), change: { op: "delete" } }));
    await promisifyTransaction(transaction);
    if (journaled) {
      this.#onJournaled?.();
    }
  }
}
