import { PROVIDER_API_ORIGIN, type Provider } from "@overview/domain";
import type { ProviderAdapter } from "./ProviderAdapter.js";
import { anthropicAdapter } from "./providers/anthropicAdapter.js";
import { geminiAdapter } from "./providers/geminiAdapter.js";
import { openAiCompatibleAdapter } from "./providers/openAiCompatibleAdapter.js";

// docs/features/byo-providers.md, "The schema is the same object for all five, and words for the sixth".
const ADAPTERS: Record<Provider, ProviderAdapter> = {
  anthropic: anthropicAdapter,
  gemini: geminiAdapter,
  openai: openAiCompatibleAdapter({
    baseUrl: `${PROVIDER_API_ORIGIN.openai}/v1`,
    structure: "schema",
    tokenLimitField: "max_completion_tokens",
  }),
  deepseek: openAiCompatibleAdapter({ baseUrl: PROVIDER_API_ORIGIN.deepseek, structure: "prose", tokenLimitField: "max_tokens" }),
  xai: openAiCompatibleAdapter({ baseUrl: `${PROVIDER_API_ORIGIN.xai}/v1`, structure: "schema", tokenLimitField: "max_tokens" }),
  mistral: openAiCompatibleAdapter({ baseUrl: `${PROVIDER_API_ORIGIN.mistral}/v1`, structure: "schema", tokenLimitField: "max_tokens" }),
};

export const adapterFor = (provider: Provider): ProviderAdapter => ADAPTERS[provider];
