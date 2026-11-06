import type { AccentColour } from "@overview/domain";
import type { AppBuild } from "../../src/app/AppBuildContext.js";
import type { ErrorDestination } from "../../src/app/ErrorDestinationMirrorContext.js";
import type { AppRouter } from "../../src/app/createAppRouter.js";
import type { AppLayout } from "../../src/app/LayoutContext.js";
import type { Surface } from "../../src/app/SurfaceContext.js";
import type { IwftActiveVideoSource } from "./IwftActiveVideoSource.testHelper.js";
import type { IwftArticlePages } from "./IwftArticlePages.testHelper.js";
import type { IwftPlaybackSource } from "./IwftPlaybackSource.testHelper.js";
import type { IwftRunBridge } from "./IwftRunBridge.testHelper.js";
import type { YouTubeFetch } from "@overview/transcripts";
import type { InMemoryCaptureQueueStore } from "../../src/features/captureQueue/types/InMemoryCaptureQueueStore.testHelper.js";
import type { InMemoryFollowedPlaylistStore } from "../../src/features/playlists/types/InMemoryFollowedPlaylistStore.testHelper.js";
import type { InMemoryOverviewStore } from "./InMemoryOverviewStore.testHelper.js";
import type { InMemorySettingsStore } from "./InMemorySettingsStore.testHelper.js";
import type { InMemoryTranscriptStore } from "./InMemoryTranscriptStore.testHelper.js";
import type { InMemorySyncStorage } from "./InMemorySyncStorage.testHelper.js";
import type { DeleteLibrary, Library, OpenLibrary } from "../../src/stores/Library.js";
import type { SyncConnection } from "../../src/features/sync/types/SyncConnection.js";
import type { OnboardingRunPhase } from "../../src/features/onboarding/useOnboardingRun.js";

declare global {
  interface Window {
    // The library the app has open now: the one the test seeded, until a sign-in or
    // sign-out switches it (docs/features/account-libraries.md).
    __iwftStores__: {
      overviewStore: InMemoryOverviewStore;
      settingsStore: InMemorySettingsStore;
      transcriptStore: InMemoryTranscriptStore;
      followedPlaylistStore: InMemoryFollowedPlaylistStore;
      captureQueueStore: InMemoryCaptureQueueStore;
      syncStorage: InMemorySyncStorage | null;
    };
    // Every library opened so far, by account, the no-account one under null.
    __iwftLibraries__: Map<string | null, Window["__iwftStores__"]>;
    __iwftLibrary__: Library;
    __iwftOpenLibrary__: OpenLibrary;
    // A deleted account's library, dropped from the map above (docs/features/account-deletion.md).
    __iwftDeleteLibrary__: DeleteLibrary;
    // Another tab of this browser: signing in, or holding onboarding's run, as this tab sees it.
    __iwftAnotherTab__: {
      signsIn: (connection: SyncConnection) => void;
      holdsOnboardingRun: (link: string, phase: OnboardingRunPhase) => void;
      closes: () => void;
    };
    __iwftRouter__: AppRouter;
    __iwftSurface__: Surface;
    __iwftLayout__: AppLayout;
    __iwftDefaultApiUrl__: string | null;
    __iwftBuild__: AppBuild | null;
    __iwftActiveVideo__: IwftActiveVideoSource | null;
    __iwftArticlePages__: IwftArticlePages | null;
    __iwftPlayback__: IwftPlaybackSource | null;
    __iwftRunBridge__: IwftRunBridge | null;
    __iwftYouTubeFetch__: YouTubeFetch | null;
    __iwftErrorDestinations__: ErrorDestination[] | null;
    __iwftAccentMirror__: AccentColour[] | null;
  }
}
