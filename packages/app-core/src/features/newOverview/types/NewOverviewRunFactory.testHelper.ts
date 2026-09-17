import type { NewOverviewRun } from "./NewOverviewRun.js";

export const makeNewOverviewRun = (overrides: Partial<NewOverviewRun> = {}): NewOverviewRun => ({
  url: "https://www.youtube.com/watch?v=example",
  startedAt: 0,
  finishedAt: null,
  video: null,
  transcriptWords: null,
  overview: null,
  error: null,
  ...overrides,
});
