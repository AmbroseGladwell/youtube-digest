import { createContext, useContext } from "react";
import type {
  CaptureQueueStore,
  ChatStore,
  FollowedPlaylistStore,
  OverviewStore,
  ProjectStore,
  SettingsStore,
  SuggestedQuestionStore,
  SyncStorage,
  TranscriptStore,
} from "@overview/domain";

export interface Stores {
  overviewStore: OverviewStore;
  settingsStore: SettingsStore;
  transcriptStore: TranscriptStore;
  followedPlaylistStore: FollowedPlaylistStore;
  captureQueueStore: CaptureQueueStore;
  projectStore: ProjectStore;
  chatStore: ChatStore;
  suggestedQuestionStore: SuggestedQuestionStore;
  // Null in a shell whose library cannot sync, and every sync control then hides itself.
  syncStorage: SyncStorage | null;
}

// No default: which backend answers the stores is the mounting shell's decision, not app-core's.
const StoresContext = createContext<Stores | null>(null);

export const StoresProvider = StoresContext.Provider;

export const useStores = (): Stores => {
  const stores = useContext(StoresContext);
  if (!stores) {
    throw new Error("useStores must be used within a StoresProvider");
  }
  return stores;
};
