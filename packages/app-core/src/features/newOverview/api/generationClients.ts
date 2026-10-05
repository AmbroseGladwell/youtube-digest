import Anthropic from "@anthropic-ai/sdk";
import { createAnthropicGenerationClient, type GenerationClient } from "@overview/generation";
import type { AnthropicModel } from "@overview/domain";
import { createFetchServiceTranscriptApi, createFetchSharedTranscriptApi } from "@overview/sync";
import type { YouTubeFetch } from "@overview/transcripts";
import { innerTubeTranscriptSource } from "../../transcripts/api/innerTubeTranscriptSource.js";
import { serviceTranscriptSource } from "../../transcripts/api/serviceTranscriptSource.js";
import { sharedCacheTranscriptSource } from "../../transcripts/api/sharedCacheTranscriptSource.js";
import type { TranscriptSource } from "../../transcripts/types/TranscriptSource.js";

// BYO-key, called straight from the browser holding the key (docs/architecture/v1-architecture-decisions.md
// Model D) — dangerouslyAllowBrowser is the SDK's own opt-in for exactly this shape, not
// a workaround: Anthropic serves this call with the anthropic-dangerous-direct-browser-access
// header the SDK sets automatically once this flag is on.
export function createGenerationClient(anthropicApiKey: string, model: AnthropicModel): GenerationClient {
  return createAnthropicGenerationClient(
    new Anthropic({ apiKey: anthropicApiKey, dangerouslyAllowBrowser: true }),
    model,
  );
}

export interface TranscriptSourceOptions {
  // Where the shared cache is asked. Null keeps the video id on this device.
  sharedCacheApiUrl: string | null;
  youTubeFetch: YouTubeFetch | null;
  // Where our own server is asked to fetch, last, and the session it counts against: none
  // counts against the reader's address. Null never asks it.
  service: { apiUrl: string; token: string | null } | null;
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
            createFetchServiceTranscriptApi({ baseUrl: options.service.apiUrl, token: options.service.token }),
          ),
        ]),
  ];
}
