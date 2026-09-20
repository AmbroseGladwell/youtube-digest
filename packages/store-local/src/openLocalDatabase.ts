import { LocalDatabaseBlockedError } from "./LocalDatabaseBlockedError.js";
import {
  DATABASE_NAME,
  DATABASE_VERSION,
  OVERVIEWS_STORE,
  OVERVIEW_STATES_STORE,
  SETTINGS_STORE,
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
