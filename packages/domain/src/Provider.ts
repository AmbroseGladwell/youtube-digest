import { z } from "zod";

// The six an overview can be generated with (docs/features/byo-providers.md). An enum
// rather than free text because a provider is a code path — an adapter, an origin the
// extension must be granted, a key format — not a value a reader can invent.
export const Provider = z.enum(["anthropic", "openai", "gemini", "deepseek", "xai", "mistral"]);
export type Provider = z.infer<typeof Provider>;

// Design 110a's order: Anthropic leads because it is the one the product was built and
// judged on, and the rest follow the card's own order.
export const PROVIDERS: readonly Provider[] = [
  "anthropic",
  "openai",
  "gemini",
  "deepseek",
  "xai",
  "mistral",
];

// Anthropic leads the list and is what a reader with no choice saved falls back to: it is
// the provider the overview format was built and judged on (design 110a).
export const DEFAULT_PROVIDER: Provider = "anthropic";

export const PROVIDER_LABEL: Record<Provider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  gemini: "Google Gemini",
  deepseek: "DeepSeek",
  xai: "xAI Grok",
  mistral: "Mistral",
};

// What a sentence calls it when the full label would read oddly mid-line — "this computer
// has no Gemini key", not "no Google Gemini key" (design 110g).
export const PROVIDER_SHORT_LABEL: Record<Provider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  gemini: "Gemini",
  deepseek: "DeepSeek",
  xai: "Grok",
  mistral: "Mistral",
};

// Where a reader who has never made an API key goes to make one. The host is shown as the
// link's own words (design 110d: "Make one at platform.openai.com"), so the two cannot
// drift apart.
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

// The origin the browser calls with the reader's key, and the one the extension has to be
// granted before it can (docs/features/byo-providers.md, "What the extension has to ask
// for"). Every one of these answers a cross-origin preflight, which is what makes
// browser-held keys possible at all.
export const PROVIDER_API_ORIGIN: Record<Provider, string> = {
  anthropic: "https://api.anthropic.com",
  openai: "https://api.openai.com",
  gemini: "https://generativelanguage.googleapis.com",
  deepseek: "https://api.deepseek.com",
  xai: "https://api.x.ai",
  mistral: "https://api.mistral.ai",
};

export const providerHostPermission = (provider: Provider): string =>
  `${PROVIDER_API_ORIGIN[provider]}/*`;
