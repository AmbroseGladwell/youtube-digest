import { createGenerationClient as createProviderClient, type GenerationClient } from "@overview/generation";
import type { Provider } from "@overview/domain";
import { createFetchServiceTranscriptApi, createFetchSharedTranscriptApi } from "@overview/sync";
import type { YouTubeFetch } from "@overview/transcripts";
import { innerTubeTranscriptSource } from "../../transcripts/api/innerTubeTranscriptSource.js";
import { serviceTranscriptSource } from "../../transcripts/api/serviceTranscriptSource.js";
import { sharedCacheTranscriptSource } from "../../transcripts/api/sharedCacheTranscriptSource.js";
import type { TranscriptSource } from "../../transcripts/types/TranscriptSource.js";

// BYO-key, called straight from the browser holding the key
// (docs/architecture/v1-architecture-decisions.md Model D). Every one of the six providers
// answers a cross-origin preflight, so no server of ours is ever in the path; the adapter
// behind this sends whatever header its provider needs to permit it.
export function createGenerationClient(provider: Provider, apiKey: string, model: string): GenerationClient {
  return createProviderClient({ provider, apiKey, model });
}

export interface TranscriptSourceOptions {
  // Where the shared cache is asked. Null keeps the video id on this device.
  sharedCacheApiUrl: string | null;
  youTubeFetch: YouTubeFetch | null;
  // Where our own server is asked to fetch, last, and the session it counts against: none
  // counts against the reader's address, and signed out the trial's token, when the device
  // holds one, lets it refuse a trial already spent on our key. Null never asks it.
  service: { apiUrl: string; token: string | null; trialToken?: string | null } | null;
}

// The rungs this surface can actually reach, in the order they are asked: the free ones
// first, our own server last (docs/features/transcript-retrieval.md).
export function createTranscriptSources(options: TranscriptSourceOptions): TranscriptSource[] {
  return [
    ...(options.sharedCacheApiUrl === null
      ? []
      : [sharedCacheTranscriptSource(createFetchSharedTranscriptApi({ baseUrl: options.sharedCacheApiUrl }))]),
    ...(options.youTubeFetch === null ? [] : [innerTubeTranscriptSource(options.youTubeFetch)]),
    ...(options.service === null
      ? []
      : [
          serviceTranscriptSource(
            createFetchServiceTranscriptApi({
              baseUrl: options.service.apiUrl,
              token: options.service.token,
              trialToken: options.service.trialToken ?? null,
            }),
          ),
        ]),
  ];
}
