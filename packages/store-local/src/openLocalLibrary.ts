import { IndexedDbCaptureQueueStore } from "./IndexedDbCaptureQueueStore.js";
import { IndexedDbChatStore } from "./IndexedDbChatStore.js";
import { IndexedDbFollowedPlaylistStore } from "./IndexedDbFollowedPlaylistStore.js";
import { IndexedDbOverviewStore } from "./IndexedDbOverviewStore.js";
import { IndexedDbProjectStore } from "./IndexedDbProjectStore.js";
import { IndexedDbSettingsStore } from "./IndexedDbSettingsStore.js";
import { IndexedDbSuggestedQuestionStore } from "./IndexedDbSuggestedQuestionStore.js";
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
  projectStore: IndexedDbProjectStore;
  chatStore: IndexedDbChatStore;
  suggestedQuestionStore: IndexedDbSuggestedQuestionStore;
  syncStorage: IndexedDbSyncStorage;
  close: () => void;
}

export interface OpenLocalLibraryOptions {
  accountId: string | null;
  indexedDB?: IDBFactory;
  onSuperseded?: () => void;
}

export const openLocalLibrary = async ({ accountId, ...options }: OpenLocalLibraryOptions): Promise<LocalLibrary> => {
  const db = await openLocalDatabase({ ...options, name: localDatabaseName(accountId) });
  const syncStorage = new IndexedDbSyncStorage(db);
  return {
    overviewStore: new IndexedDbOverviewStore(db, { onJournaled: syncStorage.notifyJournaled }),
    settingsStore: new IndexedDbSettingsStore(db, { onJournaled: syncStorage.notifyJournaled }),
    transcriptStore: new IndexedDbTranscriptStore(db),
    followedPlaylistStore: new IndexedDbFollowedPlaylistStore(db, { onJournaled: syncStorage.notifyJournaled }),
    captureQueueStore: new IndexedDbCaptureQueueStore(db),
    projectStore: new IndexedDbProjectStore(db, { onJournaled: syncStorage.notifyJournaled }),
    chatStore: new IndexedDbChatStore(db, { onJournaled: syncStorage.notifyJournaled }),
    suggestedQuestionStore: new IndexedDbSuggestedQuestionStore(db, { onJournaled: syncStorage.notifyJournaled }),
    syncStorage,
    close: () => db.close(),
  };
};
