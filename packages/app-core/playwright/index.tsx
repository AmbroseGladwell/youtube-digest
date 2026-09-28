import { beforeMount } from "@playwright/experimental-ct-react/hooks";
import "../src/theme/global.scss";
import { writeApiKeys } from "../src/features/apiKeys/apiKeyStorage.js";
import { writeSyncConnection } from "../src/features/sync/syncConnectionStorage.js";
import { DEFAULT_SYNC_CONNECTION } from "../src/features/sync/types/SyncConnection.js";
import type { IwftHooksConfig } from "./network/IwftHooksConfig.testHelper.js";
import { IwftActiveVideoSource } from "./network/IwftActiveVideoSource.testHelper.js";
import { IwftPlaybackSource } from "./network/IwftPlaybackSource.testHelper.js";
import { IwftRunBridge } from "./network/IwftRunBridge.testHelper.js";
import { iwftYouTubeFetch } from "./network/IwftYouTubeFetch.testHelper.js";
import { InMemoryOverviewStore } from "./network/InMemoryOverviewStore.testHelper.js";
import { InMemorySettingsStore } from "./network/InMemorySettingsStore.testHelper.js";
import { InMemoryTranscriptStore } from "./network/InMemoryTranscriptStore.testHelper.js";
import { InMemorySyncStorage } from "./network/InMemorySyncStorage.testHelper.js";
import type {} from "./network/iwftWindow.testHelper.js";

beforeMount<IwftHooksConfig>(async ({ hooksConfig }) => {
  const overviewStore = new InMemoryOverviewStore();
  const settingsStore = new InMemorySettingsStore();
  const transcriptStore = new InMemoryTranscriptStore();
  const syncStorage =
    hooksConfig?.syncAvailable === true ? new InMemorySyncStorage(overviewStore, settingsStore) : null;

  for (const overview of hooksConfig?.seedOverviews ?? []) overviewStore.seedOverview(overview);
  for (const state of hooksConfig?.seedStates ?? []) overviewStore.seedState(state);
  for (const topic of hooksConfig?.seedTopics ?? []) overviewStore.seedTopic(topic);
  for (const record of hooksConfig?.seedUnreadable ?? []) overviewStore.seedUnreadable(record);
  for (const transcript of hooksConfig?.seedTranscripts ?? [])
    transcriptStore.seedTranscript(transcript);
  if (hooksConfig?.seedSettings) settingsStore.seedSettings(hooksConfig.seedSettings);
  for (const read of hooksConfig?.failingReads ?? []) overviewStore.failOn(read);
  if (hooksConfig?.apiKeys) writeApiKeys(hooksConfig.apiKeys);
  writeSyncConnection(hooksConfig?.syncConnection ?? DEFAULT_SYNC_CONNECTION);

  window.__iwftStores__ = { overviewStore, settingsStore, transcriptStore, syncStorage };
  window.__iwftSurface__ = hooksConfig?.surface ?? "web";
  window.__iwftLayout__ = hooksConfig?.layout ?? "full";
  window.__iwftDefaultApiUrl__ = hooksConfig?.defaultApiUrl ?? null;
  window.__iwftBuild__ = hooksConfig?.build ?? null;
  window.__iwftActiveVideo__ =
    hooksConfig?.activeVideoUrl === undefined
      ? null
      : new IwftActiveVideoSource(hooksConfig.activeVideoUrl);
  window.__iwftPlayback__ =
    hooksConfig?.playback === undefined ? null : new IwftPlaybackSource(hooksConfig.playback);
  window.__iwftRunBridge__ = hooksConfig?.runBridge === true ? new IwftRunBridge() : null;
  window.__iwftYouTubeFetch__ = hooksConfig?.youTubeFetch === true ? iwftYouTubeFetch : null;
});
