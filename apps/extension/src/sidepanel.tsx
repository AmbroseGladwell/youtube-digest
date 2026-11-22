import { chromeActiveVideoSource } from "./chromeActiveVideoSource.js";
import { chromeArticlePages } from "./chromeArticlePages.js";
import { chromePlaybackSource } from "./chromePlaybackSource.js";
import { chromeRunBridge } from "./chromeRunBridge.js";
import { chromeYouTubeFetcher } from "./chromeYouTubeFetcher.js";
import { mountApp } from "./mountApp.js";

// docs/features/extension-panel.md, "A layout the shell asks for, alongside the surface it already declared".
void mountApp({
  layout: "panel",
  activeVideo: chromeActiveVideoSource,
  articlePages: chromeArticlePages,
  playback: chromePlaybackSource,
  runBridge: chromeRunBridge,
  youTubeFetch: chromeYouTubeFetcher,
});
