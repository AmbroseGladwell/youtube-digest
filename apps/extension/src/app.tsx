import { chromeYouTubeFetcher } from "./chromeYouTubeFetcher.js";
import { mountApp } from "./mountApp.js";

// A pasted URL still takes the free caption path: the full page is the same privileged origin as the panel.
void mountApp({ youTubeFetch: chromeYouTubeFetcher });
