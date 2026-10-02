import type { AppBuild } from "../../src/app/AppBuildContext.js";
import type { ErrorDestination } from "../../src/app/ErrorDestinationMirrorContext.js";
import type { AppRouter } from "../../src/app/createAppRouter.js";
import type { AppLayout } from "../../src/app/LayoutContext.js";
import type { Surface } from "../../src/app/SurfaceContext.js";
import type { IwftActiveVideoSource } from "./IwftActiveVideoSource.testHelper.js";
import type { IwftPlaybackSource } from "./IwftPlaybackSource.testHelper.js";
import type { IwftRunBridge } from "./IwftRunBridge.testHelper.js";
import type { YouTubeFetch } from "@overview/transcripts";
import type { InMemoryOverviewStore } from "./InMemoryOverviewStore.testHelper.js";
import type { InMemorySettingsStore } from "./InMemorySettingsStore.testHelper.js";
import type { InMemoryTranscriptStore } from "./InMemoryTranscriptStore.testHelper.js";
import type { InMemorySyncStorage } from "./InMemorySyncStorage.testHelper.js";
import type { Library, OpenLibrary } from "../../src/stores/Library.js";

declare global {
  interface Window {
    // The library the app has open now: the one the test seeded, until a sign-in or
    // sign-out switches it (docs/features/account-libraries.md).
    __iwftStores__: {
      overviewStore: InMemoryOverviewStore;
      settingsStore: InMemorySettingsStore;
      transcriptStore: InMemoryTranscriptStore;
      syncStorage: InMemorySyncStorage | null;
    };
    __iwftLibrary__: Library;
    __iwftOpenLibrary__: OpenLibrary;
    __iwftRouter__: AppRouter;
    __iwftSurface__: Surface;
    __iwftLayout__: AppLayout;
    __iwftDefaultApiUrl__: string | null;
    __iwftBuild__: AppBuild | null;
    __iwftActiveVideo__: IwftActiveVideoSource | null;
    __iwftPlayback__: IwftPlaybackSource | null;
    __iwftRunBridge__: IwftRunBridge | null;
    __iwftYouTubeFetch__: YouTubeFetch | null;
    __iwftErrorDestinations__: ErrorDestination[] | null;
  }
}
