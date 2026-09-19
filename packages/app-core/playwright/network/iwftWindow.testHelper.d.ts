import type { Surface } from "../../src/app/SurfaceContext.js";
import type { IwftActiveVideoSource } from "./IwftActiveVideoSource.testHelper.js";
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
    __iwftActiveVideo__: IwftActiveVideoSource | null;
  }
}
