import type { InMemoryOverviewStore } from "./InMemoryOverviewStore.testHelper.js";
import type { InMemorySettingsStore } from "./InMemorySettingsStore.testHelper.js";

declare global {
  interface Window {
    __iwftStores__: { overviewStore: InMemoryOverviewStore; settingsStore: InMemorySettingsStore };
  }
}
