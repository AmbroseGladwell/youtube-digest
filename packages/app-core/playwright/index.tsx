import { beforeMount } from "@playwright/experimental-ct-react/hooks";
import "../src/theme/global.scss";
import { writeApiKeys } from "../src/features/apiKeys/apiKeyStorage.js";
import type { IwftHooksConfig } from "./network/IwftHooksConfig.testHelper.js";
import { InMemoryOverviewStore } from "./network/InMemoryOverviewStore.testHelper.js";
import { InMemorySettingsStore } from "./network/InMemorySettingsStore.testHelper.js";
import { InMemoryTranscriptStore } from "./network/InMemoryTranscriptStore.testHelper.js";
import type {} from "./network/iwftWindow.testHelper.js";

beforeMount<IwftHooksConfig>(async ({ hooksConfig }) => {
  const overviewStore = new InMemoryOverviewStore();
  const settingsStore = new InMemorySettingsStore();
  const transcriptStore = new InMemoryTranscriptStore();

  for (const overview of hooksConfig?.seedOverviews ?? []) overviewStore.seedOverview(overview);
  for (const state of hooksConfig?.seedStates ?? []) overviewStore.seedState(state);
  for (const topic of hooksConfig?.seedTopics ?? []) overviewStore.seedTopic(topic);
  for (const transcript of hooksConfig?.seedTranscripts ?? []) transcriptStore.seedTranscript(transcript);
  if (hooksConfig?.apiKeys) writeApiKeys(hooksConfig.apiKeys);

  window.__iwftStores__ = { overviewStore, settingsStore, transcriptStore };
  window.__iwftSurface__ = hooksConfig?.surface ?? "web";
});
