import {
  CURRENT_FOLLOWED_FEED_SCHEMA_VERSION,
  FOLLOWED_FEED_MIGRATIONS,
  FollowedFeed,
  readStoredRecord,
  stampStoredRecord,
  type FollowedFeedStore,
  type FollowedFeedCheck,
  type FeedId,
} from "@overview/domain";
import { appendPendingWrite, JOURNALLED_STORES } from "./appendPendingWrite.js";
import type { IndexedDbStoreOptions } from "./IndexedDbStoreOptions.js";
import { FOLLOWED_FEEDS_STORE, FEED_CHECKS_STORE } from "./localDatabaseSchema.js";
import { promisifyRequest } from "./promisifyRequest.js";
import { promisifyTransaction } from "./promisifyTransaction.js";

export class IndexedDbFollowedFeedStore implements FollowedFeedStore {
  #db: IDBDatabase;
  #onJournaled: (() => void) | undefined;

  constructor(db: IDBDatabase, { onJournaled }: IndexedDbStoreOptions = {}) {
    this.#db = db;
    this.#onJournaled = onJournaled;
  }

  async listFollowed(): Promise<FollowedFeed[]> {
    const store = this.#db.transaction(FOLLOWED_FEEDS_STORE, "readonly").objectStore(FOLLOWED_FEEDS_STORE);
    const raws = await promisifyRequest<unknown[]>(store.getAll());
    return raws
      .map((raw) => readStoredRecord(raw, FollowedFeed, FOLLOWED_FEED_MIGRATIONS))
      .flatMap((read) => (read.status === "read" ? [read.record] : []));
  }

  async saveFollowed(feed: FollowedFeed): Promise<void> {
    const now = new Date();
    const record = stampStoredRecord(feed, CURRENT_FOLLOWED_FEED_SCHEMA_VERSION, now);
    const transaction = this.#db.transaction([FOLLOWED_FEEDS_STORE, ...JOURNALLED_STORES], "readwrite");
    transaction.objectStore(FOLLOWED_FEEDS_STORE).put(record);
    const journaled = await appendPendingWrite(transaction, {
      kind: "followedFeed",
      id: feed.id,
      updatedAt: now.toISOString(),
      change: { op: "replace", record },
    });
    await promisifyTransaction(transaction);
    if (journaled) {
      this.#onJournaled?.();
    }
  }

  async unfollow(feedId: FeedId): Promise<void> {
    const transaction = this.#db.transaction([FOLLOWED_FEEDS_STORE, FEED_CHECKS_STORE, ...JOURNALLED_STORES], "readwrite");
    const followed = transaction.objectStore(FOLLOWED_FEEDS_STORE);
    const existing = await promisifyRequest<unknown>(followed.get(feedId));
    followed.delete(feedId);
    transaction.objectStore(FEED_CHECKS_STORE).delete(feedId);
    const journaled =
      existing !== undefined &&
      (await appendPendingWrite(transaction, {
        kind: "followedFeed",
        id: feedId,
        updatedAt: new Date().toISOString(),
        change: { op: "delete" },
      }));
    await promisifyTransaction(transaction);
    if (journaled) {
      this.#onJournaled?.();
    }
  }

  async getCheck(feedId: FeedId): Promise<FollowedFeedCheck | null> {
    const store = this.#db.transaction(FEED_CHECKS_STORE, "readonly").objectStore(FEED_CHECKS_STORE);
    return (await promisifyRequest<FollowedFeedCheck | undefined>(store.get(feedId))) ?? null;
  }

  async saveCheck(check: FollowedFeedCheck): Promise<void> {
    const transaction = this.#db.transaction(FEED_CHECKS_STORE, "readwrite");
    transaction.objectStore(FEED_CHECKS_STORE).put(check);
    await promisifyTransaction(transaction);
  }
}
