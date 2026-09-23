import Anthropic from "@anthropic-ai/sdk";
import { Supadata } from "@supadata/js";
import { createAnthropicGenerationClient, type GenerationClient } from "@overview/generation";
import type { AnthropicModel } from "@overview/domain";
import type { YouTubeFetch } from "@overview/transcripts";
import { innerTubeTranscriptSource } from "../../transcripts/api/innerTubeTranscriptSource.js";
import { supadataTranscriptSource } from "../../transcripts/api/supadataTranscriptSource.js";
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
  youTubeFetch: YouTubeFetch | null;
  supadataApiKey: string | null;
}

// The rungs this surface can actually reach, in the order they are asked. The free one
// goes first: a key holder's experience is unchanged except that it stops spending
// credits when there was a free path (docs/features/transcript-retrieval.md).
export function createTranscriptSources(options: TranscriptSourceOptions): TranscriptSource[] {
  return [
    ...(options.youTubeFetch === null ? [] : [innerTubeTranscriptSource(options.youTubeFetch)]),
    ...(options.supadataApiKey === null
      ? []
      : [supadataTranscriptSource(new Supadata({ apiKey: options.supadataApiKey }))]),
  ];
}
