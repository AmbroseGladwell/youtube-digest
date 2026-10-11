import { PROVIDER_API_ORIGIN, type Provider } from "@overview/domain";
import type { ProviderAdapter } from "./ProviderAdapter.js";
import { anthropicAdapter } from "./providers/anthropicAdapter.js";
import { geminiAdapter } from "./providers/geminiAdapter.js";
import { openAiCompatibleAdapter } from "./providers/openAiCompatibleAdapter.js";

// DeepSeek is the one provider with no structured-output mode: it has JSON mode and
// nothing else, so the shape is taught in the prompt and checked on the way back. That is
// not a special case bolted on — generateOverview already re-asks once when an answer
// breaks its own rules, because structured outputs never enforced the array caps either
// (docs/features/overview-generation-decisions.md). DeepSeek leans on it harder.
const ADAPTERS: Record<Provider, ProviderAdapter> = {
  anthropic: anthropicAdapter,
  gemini: geminiAdapter,
  openai: openAiCompatibleAdapter({ baseUrl: `${PROVIDER_API_ORIGIN.openai}/v1`, structure: "schema" }),
  deepseek: openAiCompatibleAdapter({ baseUrl: PROVIDER_API_ORIGIN.deepseek, structure: "prose" }),
  xai: openAiCompatibleAdapter({ baseUrl: `${PROVIDER_API_ORIGIN.xai}/v1`, structure: "schema" }),
  mistral: openAiCompatibleAdapter({ baseUrl: `${PROVIDER_API_ORIGIN.mistral}/v1`, structure: "schema" }),
};

export const adapterFor = (provider: Provider): ProviderAdapter => ADAPTERS[provider];
