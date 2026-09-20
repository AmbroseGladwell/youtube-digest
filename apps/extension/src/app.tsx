import { chromeYouTubeFetcher } from "./chromeYouTubeFetcher.js";
import { mountApp } from "./mountApp.js";

// The full page has no tab beside it, but a pasted URL should still take the free
// caption path: it is the same privileged origin as the panel
// (docs/features/transcript-retrieval.md).
void mountApp({ youTubeFetch: chromeYouTubeFetcher });
