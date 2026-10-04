import { beforeMount } from "@playwright/experimental-ct-react/hooks";
import "../src/theme/global.scss";
import { writeApiKeys } from "../src/features/apiKeys/apiKeyStorage.js";
import { writeSyncConnection } from "../src/features/sync/syncConnectionStorage.js";
import { writePendingSignIn } from "../src/features/auth/pendingSignInStorage.js";
import { writeDeviceAccountHistory } from "../src/features/accountLibraries/deviceAccountHistoryStorage.js";
import { NO_ACCOUNT_HISTORY } from "../src/features/accountLibraries/types/DeviceAccountHistory.js";
import { writeAnalyticsConsent } from "../src/features/analyticsConsent/analyticsConsentStorage.js";
import {
  DEFAULT_SYNC_CONNECTION,
  libraryAccountIdOf,
  SyncConnection,
} from "../src/features/sync/types/SyncConnection.js";
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

const makeStores = (syncAvailable: boolean): Window["__iwftStores__"] => {
  const overviewStore = new InMemoryOverviewStore();
  const settingsStore = new InMemorySettingsStore();
  const transcriptStore = new InMemoryTranscriptStore();
  const syncStorage = syncAvailable ? new InMemorySyncStorage(overviewStore, settingsStore, transcriptStore) : null;
  return { overviewStore, settingsStore, transcriptStore, syncStorage };
};

beforeMount<IwftHooksConfig>(async ({ hooksConfig }) => {
  const syncAvailable = hooksConfig?.syncAvailable === true;
  const connection = SyncConnection.parse(hooksConfig?.syncConnection ?? DEFAULT_SYNC_CONNECTION);
  const seeded = makeStores(syncAvailable);
  const { overviewStore, settingsStore, transcriptStore } = seeded;
  const libraries = new Map<string | null, Window["__iwftStores__"]>([[libraryAccountIdOf(connection), seeded]]);

  for (const overview of hooksConfig?.seedOverviews ?? []) overviewStore.seedOverview(overview);
  for (const state of hooksConfig?.seedStates ?? []) overviewStore.seedState(state);
  for (const topic of hooksConfig?.seedTopics ?? []) overviewStore.seedTopic(topic);
  for (const record of hooksConfig?.seedUnreadable ?? []) overviewStore.seedUnreadable(record);
  for (const transcript of hooksConfig?.seedTranscripts ?? [])
    transcriptStore.seedTranscript(transcript);
  if (hooksConfig?.seedSettings) settingsStore.seedSettings(hooksConfig.seedSettings);
  for (const read of hooksConfig?.failingReads ?? []) overviewStore.failOn(read);
  if (hooksConfig?.apiKeys) writeApiKeys(hooksConfig.apiKeys);
  writeSyncConnection(connection);
  writePendingSignIn(hooksConfig?.pendingSignIn ?? null);
  writeDeviceAccountHistory(hooksConfig?.deviceAccountHistory ?? NO_ACCOUNT_HISTORY);
  writeAnalyticsConsent(hooksConfig?.analyticsConsent ?? null);

  window.__iwftStores__ = seeded;
  window.__iwftLibraries__ = libraries;
  window.__iwftLibrary__ = { accountId: libraryAccountIdOf(connection), stores: seeded, close: () => undefined };
  window.__iwftOpenLibrary__ = async (accountId, { shown = true } = {}) => {
    const stores = libraries.get(accountId) ?? makeStores(syncAvailable);
    libraries.set(accountId, stores);
    if (shown) window.__iwftStores__ = stores;
    return { accountId, stores, close: () => undefined };
  };
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
  window.__iwftErrorDestinations__ = hooksConfig?.errorDestinationMirror === true ? [] : null;
});
