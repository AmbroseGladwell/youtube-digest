import type { AppLayout } from "../../src/app/LayoutContext.js";
import type { Surface } from "../../src/app/SurfaceContext.js";
import type { IwftActiveVideoSource } from "./IwftActiveVideoSource.testHelper.js";
import type { IwftPlaybackSource } from "./IwftPlaybackSource.testHelper.js";
import type { IwftRunBridge } from "./IwftRunBridge.testHelper.js";
import type { YouTubeFetch } from "@overview/transcripts";
import type { InMemoryOverviewStore } from "./InMemoryOverviewStore.testHelper.js";
import type { InMemorySettingsStore } from "./InMemorySettingsStore.testHelper.js";
import type { InMemoryTranscriptStore } from "./InMemoryTranscriptStore.testHelper.js";

declare global {
  interface Window {
    __iwftStores__: {
      overviewStore: InMemoryOverviewStore;
      settingsStore: InMemorySettingsStore;
      transcriptStore: InMemoryTranscriptStore;
    };
    __iwftSurface__: Surface;
    __iwftLayout__: AppLayout;
    __iwftActiveVideo__: IwftActiveVideoSource | null;
    __iwftPlayback__: IwftPlaybackSource | null;
    __iwftRunBridge__: IwftRunBridge | null;
    __iwftYouTubeFetch__: YouTubeFetch | null;
  }
}
