import { beforeMount } from "@playwright/experimental-ct-react/hooks";
import "../src/theme/global.scss";
import { writeApiKeys } from "../src/features/apiKeys/apiKeyStorage.js";
import { SYNC_CONNECTION_STORAGE_KEY, writeSyncConnection } from "../src/features/sync/syncConnectionStorage.js";
import {
  ONBOARDING_PROGRESS_STORAGE_KEY,
  readOnboardingProgress,
  writeOnboardingProgress,
} from "../src/features/onboarding/onboardingProgressStorage.js";
import { ONBOARDING_RUN_CHANNEL, type OnboardingRunMessage } from "../src/features/onboarding/useOnboardingRunOwner.js";
import { writePendingSignIn } from "../src/features/auth/pendingSignInStorage.js";
import { writeSignedOutTrial } from "../src/features/signedOutTrial/signedOutTrialStorage.js";
import { NO_TRIAL } from "../src/features/signedOutTrial/types/SignedOutTrial.js";
import { writeAnalyticsConsent } from "../src/features/analyticsConsent/analyticsConsentStorage.js";
import { markAccountSeen } from "../src/features/accountLibraries/accountSeenStorage.js";
import { DEFAULT_SYNC_CONNECTION, libraryAccountIdOf, SyncConnection } from "../src/features/sync/types/SyncConnection.js";
import type { IwftHooksConfig } from "./network/IwftHooksConfig.testHelper.js";
import { IwftActiveVideoSource } from "./network/IwftActiveVideoSource.testHelper.js";
import { IwftArticlePages } from "./network/IwftArticlePages.testHelper.js";
import { IwftPlaybackSource } from "./network/IwftPlaybackSource.testHelper.js";
import { IwftRunBridge } from "./network/IwftRunBridge.testHelper.js";
import { iwftYouTubeFetch } from "./network/IwftYouTubeFetch.testHelper.js";
import { InMemoryOverviewStore } from "./network/InMemoryOverviewStore.testHelper.js";
import { InMemorySettingsStore } from "./network/InMemorySettingsStore.testHelper.js";
import { InMemoryTranscriptStore } from "./network/InMemoryTranscriptStore.testHelper.js";
import { InMemorySyncStorage } from "./network/InMemorySyncStorage.testHelper.js";
import { InMemoryFollowedPlaylistStore } from "../src/features/playlists/types/InMemoryFollowedPlaylistStore.testHelper.js";
import { InMemoryCaptureQueueStore } from "../src/features/captureQueue/types/InMemoryCaptureQueueStore.testHelper.js";
import { InMemoryProjectStore } from "../src/features/projects/types/InMemoryProjectStore.testHelper.js";
import type {} from "./network/iwftWindow.testHelper.js";

const makeStores = (syncAvailable: boolean): Window["__iwftStores__"] => {
  const overviewStore = new InMemoryOverviewStore();
  const settingsStore = new InMemorySettingsStore();
  const transcriptStore = new InMemoryTranscriptStore();
  const followedPlaylistStore = new InMemoryFollowedPlaylistStore();
  const captureQueueStore = new InMemoryCaptureQueueStore();
  const projectStore = new InMemoryProjectStore();
  const syncStorage = syncAvailable ? new InMemorySyncStorage(overviewStore, settingsStore, transcriptStore, followedPlaylistStore) : null;
  return { overviewStore, settingsStore, transcriptStore, followedPlaylistStore, captureQueueStore, projectStore, syncStorage };
};

beforeMount<IwftHooksConfig>(async ({ hooksConfig }) => {
  const syncAvailable = hooksConfig?.syncAvailable === true;
  const connection = SyncConnection.parse(hooksConfig?.syncConnection ?? DEFAULT_SYNC_CONNECTION);
  const seeded = makeStores(syncAvailable);
  const { overviewStore, settingsStore, transcriptStore, followedPlaylistStore, captureQueueStore, projectStore } = seeded;
  const libraries = new Map<string | null, Window["__iwftStores__"]>([[libraryAccountIdOf(connection), seeded]]);

  for (const overview of hooksConfig?.seedOverviews ?? []) overviewStore.seedOverview(overview);
  for (const state of hooksConfig?.seedStates ?? []) overviewStore.seedState(state);
  for (const topic of hooksConfig?.seedTopics ?? []) overviewStore.seedTopic(topic);
  for (const record of hooksConfig?.seedUnreadable ?? []) overviewStore.seedUnreadable(record);
  for (const transcript of hooksConfig?.seedTranscripts ?? []) transcriptStore.seedTranscript(transcript);
  if (hooksConfig?.seedSettings) settingsStore.seedSettings(hooksConfig.seedSettings);
  for (const playlist of hooksConfig?.seedFollowedPlaylists ?? []) followedPlaylistStore.seedFollowed(playlist);
  for (const check of hooksConfig?.seedPlaylistChecks ?? []) followedPlaylistStore.seedCheck(check);
  await captureQueueStore.enqueue(hooksConfig?.seedQueue ?? []);
  for (const project of hooksConfig?.seedProjects ?? []) projectStore.seedProject(project);
  for (const member of hooksConfig?.seedProjectMembers ?? []) projectStore.seedMember(member);
  for (const read of hooksConfig?.failingReads ?? []) overviewStore.failOn(read);
  if (hooksConfig?.apiKeys) writeApiKeys(hooksConfig.apiKeys);
  writeSyncConnection(connection);
  writePendingSignIn(hooksConfig?.pendingSignIn ?? null);
  writeSignedOutTrial(hooksConfig?.signedOutTrial ?? NO_TRIAL);
  writeAnalyticsConsent(hooksConfig?.analyticsConsent ?? null);
  if (hooksConfig?.accountSeen === true) markAccountSeen();

  window.__iwftStores__ = seeded;
  window.__iwftLibraries__ = libraries;
  window.__iwftLibrary__ = { accountId: libraryAccountIdOf(connection), stores: seeded, close: () => undefined };
  window.__iwftOpenLibrary__ = async (accountId, { shown = true } = {}) => {
    const stores = libraries.get(accountId) ?? makeStores(syncAvailable);
    libraries.set(accountId, stores);
    if (shown) window.__iwftStores__ = stores;
    return { accountId, stores, close: () => undefined };
  };
  window.__iwftDeleteLibrary__ = async (accountId) => {
    libraries.delete(accountId);
  };
  // Another tab of the same browser, as this one sees it: what it writes arrives as a storage
  // event, and a run it holds answers on the channel (docs/features/onboarding.md).
  let heldRun: BroadcastChannel | null = null;
  const otherTabWrote = (key: string) => window.dispatchEvent(new StorageEvent("storage", { key, storageArea: localStorage }));
  window.__iwftAnotherTab__ = {
    signsIn: (signedIn) => {
      writeSyncConnection(SyncConnection.parse(signedIn));
      otherTabWrote(SYNC_CONNECTION_STORAGE_KEY);
    },
    holdsOnboardingRun: (link, phase) => {
      heldRun?.close();
      heldRun = new BroadcastChannel(ONBOARDING_RUN_CHANNEL);
      heldRun.onmessage = (event: MessageEvent<OnboardingRunMessage>) => {
        if (event.data.type === "ask" && event.data.link === link) {
          heldRun?.postMessage({ type: "held", link, phase } satisfies OnboardingRunMessage);
        }
      };
      const progress = readOnboardingProgress();
      if (progress !== null) {
        writeOnboardingProgress({ ...progress, runner: "another-tab" });
        otherTabWrote(ONBOARDING_PROGRESS_STORAGE_KEY);
      }
    },
    closes: () => {
      heldRun?.close();
      heldRun = null;
    },
  };
  window.__iwftSurface__ = hooksConfig?.surface ?? "web";
  window.__iwftLayout__ = hooksConfig?.layout ?? "full";
  window.__iwftDefaultApiUrl__ = hooksConfig?.defaultApiUrl ?? null;
  window.__iwftServerSwitchable__ = hooksConfig?.serverSwitchable ?? true;
  window.__iwftBuild__ = hooksConfig?.build ?? null;
  window.__iwftActiveVideo__ = hooksConfig?.activeVideoUrl === undefined ? null : new IwftActiveVideoSource(hooksConfig.activeVideoUrl);
  window.__iwftArticlePages__ = hooksConfig?.articlePages === undefined ? null : new IwftArticlePages(hooksConfig.articlePages);
  window.__iwftPlayback__ = hooksConfig?.playback === undefined ? null : new IwftPlaybackSource(hooksConfig.playback);
  window.__iwftRunBridge__ = hooksConfig?.runBridge === true ? new IwftRunBridge() : null;
  window.__iwftYouTubeFetch__ = hooksConfig?.youTubeFetch === true ? iwftYouTubeFetch : null;
  window.__iwftErrorDestinations__ = hooksConfig?.errorDestinationMirror === true ? [] : null;
  window.__iwftAccentMirror__ = hooksConfig?.accentMirror === true ? [] : null;
});
