import Anthropic from "@anthropic-ai/sdk";
import { Supadata } from "@supadata/js";
import { createAnthropicGenerationClient, type GenerationClient } from "@overview/generation";
import type { AnthropicModel } from "@overview/types";
import type { TranscriptSourceClient } from "@overview/transcripts";

// BYO-key, called straight from the browser holding the key (docs/architecture/v1-architecture-decisions.md
// Model D) — dangerouslyAllowBrowser is the SDK's own opt-in for exactly this shape, not
// a workaround: Anthropic serves this call with the anthropic-dangerous-direct-browser-access
// header the SDK sets automatically once this flag is on.
export function createTranscriptClient(supadataApiKey: string): TranscriptSourceClient {
  return new Supadata({ apiKey: supadataApiKey });
}

export function createGenerationClient(anthropicApiKey: string, model: AnthropicModel): GenerationClient {
  return createAnthropicGenerationClient(
    new Anthropic({ apiKey: anthropicApiKey, dangerouslyAllowBrowser: true }),
    model,
  );
}
