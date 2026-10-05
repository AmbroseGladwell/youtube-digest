import { LocalDatabaseBlockedError } from "./LocalDatabaseBlockedError.js";
import {
  CAPTURE_QUEUE_STORE,
  DATABASE_NAME,
  DATABASE_VERSION,
  FOLLOWED_PLAYLISTS_STORE,
  OUTBOX_STORE,
  OVERVIEWS_STORE,
  OVERVIEW_STATES_STORE,
  PLAYLIST_CHECKS_STORE,
  SETTINGS_STORE,
  SYNC_META_STORE,
  SYNC_REVISIONS_STORE,
  TOPICS_STORE,
  TRANSCRIPTS_STORE,
} from "./localDatabaseSchema.js";

export interface OpenLocalDatabaseOptions {
  name?: string;
  indexedDB?: IDBFactory;
  onSuperseded?: () => void;
}

const NOVELTY_RENAME_RESET_VERSION = 2;

export function openLocalDatabase(options: OpenLocalDatabaseOptions = {}): Promise<IDBDatabase> {
  const { name = DATABASE_NAME, indexedDB = globalThis.indexedDB, onSuperseded } = options;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, DATABASE_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const upgradingFromBeforeNoveltyRename =
        event.oldVersion > 0 && event.oldVersion < NOVELTY_RENAME_RESET_VERSION;
      if (upgradingFromBeforeNoveltyRename) {
        for (const store of [OVERVIEWS_STORE, OVERVIEW_STATES_STORE]) {
          if (db.objectStoreNames.contains(store)) db.deleteObjectStore(store);
        }
      }
      if (!db.objectStoreNames.contains(OVERVIEWS_STORE)) {
        db.createObjectStore(OVERVIEWS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(TOPICS_STORE)) {
        db.createObjectStore(TOPICS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(OVERVIEW_STATES_STORE)) {
        db.createObjectStore(OVERVIEW_STATES_STORE, { keyPath: "overviewId" });
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE);
      }
      if (!db.objectStoreNames.contains(TRANSCRIPTS_STORE)) {
        db.createObjectStore(TRANSCRIPTS_STORE, { keyPath: "videoId" });
      }
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        db.createObjectStore(OUTBOX_STORE, { keyPath: "key", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(SYNC_REVISIONS_STORE)) {
        db.createObjectStore(SYNC_REVISIONS_STORE, { keyPath: ["kind", "id"] });
      }
      if (!db.objectStoreNames.contains(SYNC_META_STORE)) {
        db.createObjectStore(SYNC_META_STORE);
      }
      if (!db.objectStoreNames.contains(FOLLOWED_PLAYLISTS_STORE)) {
        db.createObjectStore(FOLLOWED_PLAYLISTS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(PLAYLIST_CHECKS_STORE)) {
        db.createObjectStore(PLAYLIST_CHECKS_STORE, { keyPath: "playlistId" });
      }
      if (!db.objectStoreNames.contains(CAPTURE_QUEUE_STORE)) {
        db.createObjectStore(CAPTURE_QUEUE_STORE, { keyPath: "videoId" });
      }
    };

    request.onblocked = () => reject(new LocalDatabaseBlockedError(name));

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        onSuperseded?.();
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}
