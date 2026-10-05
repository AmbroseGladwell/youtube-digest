import { IndexedDbCaptureQueueStore } from "./IndexedDbCaptureQueueStore.js";
import { IndexedDbFollowedPlaylistStore } from "./IndexedDbFollowedPlaylistStore.js";
import { IndexedDbOverviewStore } from "./IndexedDbOverviewStore.js";
import { IndexedDbSettingsStore } from "./IndexedDbSettingsStore.js";
import { IndexedDbSyncStorage } from "./IndexedDbSyncStorage.js";
import { IndexedDbTranscriptStore } from "./IndexedDbTranscriptStore.js";
import { localDatabaseName } from "./localDatabaseName.js";
import { openLocalDatabase } from "./openLocalDatabase.js";

export interface LocalLibrary {
  overviewStore: IndexedDbOverviewStore;
  settingsStore: IndexedDbSettingsStore;
  transcriptStore: IndexedDbTranscriptStore;
  followedPlaylistStore: IndexedDbFollowedPlaylistStore;
  captureQueueStore: IndexedDbCaptureQueueStore;
  syncStorage: IndexedDbSyncStorage;
  close: () => void;
}

export interface OpenLocalLibraryOptions {
  accountId: string | null;
  indexedDB?: IDBFactory;
  onSuperseded?: () => void;
}

export async function openLocalLibrary({ accountId, ...options }: OpenLocalLibraryOptions): Promise<LocalLibrary> {
  const db = await openLocalDatabase({ ...options, name: localDatabaseName(accountId) });
  const syncStorage = new IndexedDbSyncStorage(db);
  return {
    overviewStore: new IndexedDbOverviewStore(db, { onJournaled: syncStorage.notifyJournaled }),
    settingsStore: new IndexedDbSettingsStore(db, { onJournaled: syncStorage.notifyJournaled }),
    transcriptStore: new IndexedDbTranscriptStore(db),
    followedPlaylistStore: new IndexedDbFollowedPlaylistStore(db, { onJournaled: syncStorage.notifyJournaled }),
    captureQueueStore: new IndexedDbCaptureQueueStore(db),
    syncStorage,
    close: () => db.close(),
  };
}
