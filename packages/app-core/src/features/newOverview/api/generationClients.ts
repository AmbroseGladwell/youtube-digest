import { createGenerationClient as createProviderClient, type GenerationClient } from "@overview/generation";
import type { Provider } from "@overview/domain";
import { createFetchServiceTranscriptApi } from "@overview/sync";
import type { YouTubeFetch } from "@overview/transcripts";
import { innerTubeTranscriptSource } from "../../transcripts/api/innerTubeTranscriptSource.js";
import { serviceTranscriptSource } from "../../transcripts/api/serviceTranscriptSource.js";
import type { TranscriptSource } from "../../transcripts/types/TranscriptSource.js";

// Called straight from the browser: every provider answers a cross-origin preflight.
export const createGenerationClient = (provider: Provider, apiKey: string, model: string): GenerationClient => {
  return createProviderClient({ provider, apiKey, model });
};

export interface TranscriptSourceOptions {
  youTubeFetch: YouTubeFetch | null;
  // Our own server, asked last. Null never asks it.
  service: { apiUrl: string; token: string | null } | null;
}

// Free rungs first, our own server last; no shared cache, each reader fetches their own (OV-295).
export const createTranscriptSources = (options: TranscriptSourceOptions): TranscriptSource[] => {
  return [
    ...(options.youTubeFetch === null ? [] : [innerTubeTranscriptSource(options.youTubeFetch)]),
    ...(options.service === null
      ? []
      : [serviceTranscriptSource(createFetchServiceTranscriptApi({ baseUrl: options.service.apiUrl, token: options.service.token }))]),
  ];
};
