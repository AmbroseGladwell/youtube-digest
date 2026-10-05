import { randomUUID } from "node:crypto";
import type { TranscriptServiceSetup } from "../buildApp.js";
import type { TranscriptServiceConfig } from "../loadConfig.js";
import { proxiedYouTubeFetch, undiciYouTubeFetch } from "./undiciYouTubeFetch.js";

export const createTranscriptServiceSetup = (
  config: NonNullable<TranscriptServiceConfig>,
): TranscriptServiceSetup => ({
  fetches: {
    direct: undiciYouTubeFetch(),
    proxied: config.proxyUrl === null ? null : proxiedYouTubeFetch(config.proxyUrl),
    newSession: () => randomUUID().replaceAll("-", "").slice(0, 16),
  },
  proxyDailyFetches: config.proxyDailyFetches,
});
