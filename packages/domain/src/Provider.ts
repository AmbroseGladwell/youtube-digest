import { z } from "zod";

// An enum: a provider is a code path, not a value a reader can invent (docs/features/byo-providers.md).
export const Provider = z.enum(["anthropic", "openai", "gemini", "deepseek", "xai", "mistral"]);
export type Provider = z.infer<typeof Provider>;

// Design 110a's order: Anthropic, which the product was built and judged on, leads.
export const PROVIDERS: readonly Provider[] = ["anthropic", "openai", "gemini", "deepseek", "xai", "mistral"];

// The overview format was built and judged on Anthropic (design 110a).
export const DEFAULT_PROVIDER: Provider = "anthropic";

export const PROVIDER_LABEL: Record<Provider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  gemini: "Google Gemini",
  deepseek: "DeepSeek",
  xai: "xAI Grok",
  mistral: "Mistral",
};

// "no Gemini key", not "no Google Gemini key" (design 110g).
export const PROVIDER_SHORT_LABEL: Record<Provider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  gemini: "Gemini",
  deepseek: "DeepSeek",
  xai: "Grok",
  mistral: "Mistral",
};

// The host is shown as the link's own words, so the two can't drift apart (design 110d).
export interface ProviderConsole {
  host: string;
  url: string;
}

export const PROVIDER_CONSOLE: Record<Provider, ProviderConsole> = {
  anthropic: { host: "console.anthropic.com", url: "https://console.anthropic.com/settings/keys" },
  openai: { host: "platform.openai.com", url: "https://platform.openai.com/api-keys" },
  gemini: { host: "aistudio.google.com", url: "https://aistudio.google.com/apikey" },
  deepseek: { host: "platform.deepseek.com", url: "https://platform.deepseek.com/api_keys" },
  xai: { host: "console.x.ai", url: "https://console.x.ai" },
  mistral: { host: "console.mistral.ai", url: "https://console.mistral.ai/api-keys" },
};

// docs/features/byo-providers.md, "What the extension has to ask for".
export const PROVIDER_API_ORIGIN: Record<Provider, string> = {
  anthropic: "https://api.anthropic.com",
  openai: "https://api.openai.com",
  gemini: "https://generativelanguage.googleapis.com",
  deepseek: "https://api.deepseek.com",
  xai: "https://api.x.ai",
  mistral: "https://api.mistral.ai",
};

export const providerHostPermission = (provider: Provider): string => `${PROVIDER_API_ORIGIN[provider]}/*`;
