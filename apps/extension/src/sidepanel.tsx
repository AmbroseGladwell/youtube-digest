import { chromeActiveVideoSource } from "./chromeActiveVideoSource.js";
import { chromePlaybackSource } from "./chromePlaybackSource.js";
import { chromeRunBridge } from "./chromeRunBridge.js";
import { chromeYouTubeFetcher } from "./chromeYouTubeFetcher.js";
import { mountApp } from "./mountApp.js";

// The panel is the one video it is beside, so it takes the pared-back layout
// (docs/features/extension-panel.md). The full page keeps the library.
void mountApp({
  layout: "panel",
  activeVideo: chromeActiveVideoSource,
  playback: chromePlaybackSource,
  runBridge: chromeRunBridge,
  youTubeFetch: chromeYouTubeFetcher,
});
