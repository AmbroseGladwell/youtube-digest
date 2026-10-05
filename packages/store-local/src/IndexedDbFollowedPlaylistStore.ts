import {
  CURRENT_FOLLOWED_PLAYLIST_SCHEMA_VERSION,
  FOLLOWED_PLAYLIST_MIGRATIONS,
  FollowedPlaylist,
  readStoredRecord,
  stampStoredRecord,
  type FollowedPlaylistStore,
  type PlaylistCheck,
  type PlaylistId,
} from "@overview/domain";
import { appendPendingWrite, JOURNALLED_STORES } from "./appendPendingWrite.js";
import type { IndexedDbStoreOptions } from "./IndexedDbStoreOptions.js";
import { FOLLOWED_PLAYLISTS_STORE, PLAYLIST_CHECKS_STORE } from "./localDatabaseSchema.js";
import { promisifyRequest } from "./promisifyRequest.js";
import { promisifyTransaction } from "./promisifyTransaction.js";

export class IndexedDbFollowedPlaylistStore implements FollowedPlaylistStore {
  #db: IDBDatabase;
  #onJournaled: (() => void) | undefined;

  constructor(db: IDBDatabase, { onJournaled }: IndexedDbStoreOptions = {}) {
    this.#db = db;
    this.#onJournaled = onJournaled;
  }

  async listFollowed(): Promise<FollowedPlaylist[]> {
    const store = this.#db.transaction(FOLLOWED_PLAYLISTS_STORE, "readonly").objectStore(FOLLOWED_PLAYLISTS_STORE);
    const raws = await promisifyRequest<unknown[]>(store.getAll());
    return raws
      .map((raw) => readStoredRecord(raw, FollowedPlaylist, FOLLOWED_PLAYLIST_MIGRATIONS))
      .flatMap((read) => (read.status === "read" ? [read.record] : []));
  }

  async saveFollowed(playlist: FollowedPlaylist): Promise<void> {
    const now = new Date();
    const record = stampStoredRecord(playlist, CURRENT_FOLLOWED_PLAYLIST_SCHEMA_VERSION, now);
    const transaction = this.#db.transaction([FOLLOWED_PLAYLISTS_STORE, ...JOURNALLED_STORES], "readwrite");
    transaction.objectStore(FOLLOWED_PLAYLISTS_STORE).put(record);
    const journaled = await appendPendingWrite(transaction, {
      kind: "followedPlaylist",
      id: playlist.id,
      updatedAt: now.toISOString(),
      change: { op: "replace", record },
    });
    await promisifyTransaction(transaction);
    if (journaled) this.#onJournaled?.();
  }

  async unfollow(playlistId: PlaylistId): Promise<void> {
    const transaction = this.#db.transaction(
      [FOLLOWED_PLAYLISTS_STORE, PLAYLIST_CHECKS_STORE, ...JOURNALLED_STORES],
      "readwrite",
    );
    const followed = transaction.objectStore(FOLLOWED_PLAYLISTS_STORE);
    const existing = await promisifyRequest<unknown>(followed.get(playlistId));
    followed.delete(playlistId);
    transaction.objectStore(PLAYLIST_CHECKS_STORE).delete(playlistId);
    const journaled =
      existing !== undefined &&
      (await appendPendingWrite(transaction, {
        kind: "followedPlaylist",
        id: playlistId,
        updatedAt: new Date().toISOString(),
        change: { op: "delete" },
      }));
    await promisifyTransaction(transaction);
    if (journaled) this.#onJournaled?.();
  }

  async getCheck(playlistId: PlaylistId): Promise<PlaylistCheck | null> {
    const store = this.#db.transaction(PLAYLIST_CHECKS_STORE, "readonly").objectStore(PLAYLIST_CHECKS_STORE);
    return (await promisifyRequest<PlaylistCheck | undefined>(store.get(playlistId))) ?? null;
  }

  async saveCheck(check: PlaylistCheck): Promise<void> {
    const transaction = this.#db.transaction(PLAYLIST_CHECKS_STORE, "readwrite");
    transaction.objectStore(PLAYLIST_CHECKS_STORE).put(check);
    await promisifyTransaction(transaction);
  }
}
