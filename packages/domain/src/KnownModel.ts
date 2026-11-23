import { PROVIDERS, type Provider } from "./Provider.js";

// A floor, not the catalogue: docs/features/byo-providers.md, "Which models are offered".
export const SONNET_MODEL_ID = "claude-sonnet-5-5";

export interface KnownModel {
  id: string;
  label: string;
  description: string;
  pricePerMillion: { input: number; output: number };
}

// Non-empty, so the fallback for a provider that won't list its models can't be emptied.
export const KNOWN_MODELS: Record<Provider, readonly [KnownModel, ...KnownModel[]]> = {
  anthropic: [
    {
      id: "claude-opus-5-5",
      label: "Claude Opus 5.5",
      description: "Most capable for everyday generation.",
      pricePerMillion: { input: 4, output: 20 },
    },
    {
      id: SONNET_MODEL_ID,
      label: "Claude Sonnet 5.5",
      description: "Faster and cheaper, a step down in depth.",
      pricePerMillion: { input: 2, output: 10 },
    },
    {
      id: "claude-haiku-5-5",
      label: "Claude Haiku 5.5",
      description: "Fastest and cheapest, least thorough.",
      pricePerMillion: { input: 0.1, output: 0.5 },
    },
  ],
  openai: [
    {
      id: "gpt-6.1-sol",
      label: "GPT-6.1 Sol",
      description: "Most capable for everyday generation.",
      pricePerMillion: { input: 2, output: 10 },
    },
    {
      id: "gpt-6-luna",
      label: "GPT-6 Luna",
      description: "Faster and cheaper, a step down in depth.",
      pricePerMillion: { input: 0.1, output: 0.5 },
    },
  ],
  gemini: [
    {
      id: "gemini-3.6",
      label: "Gemini 3.6",
      description: "Most capable, and the best with very long transcripts.",
      pricePerMillion: { input: 2, output: 12 },
    },
    {
      id: "gemini-3.6-flash",
      label: "Gemini 3.6 Flash",
      description: "Faster and cheaper, a step down in depth.",
      pricePerMillion: { input: 0.75, output: 3.75 },
    },
  ],
  deepseek: [
    {
      id: "deepseek-v4-pro",
      label: "DeepSeek V4 Pro",
      description: "Most capable for everyday generation.",
      pricePerMillion: { input: 0.66, output: 1.98 },
    },
    {
      id: "deepseek-flash",
      label: "DeepSeek Flash",
      description: "Faster and cheaper, a step down in depth.",
      pricePerMillion: { input: 0.3, output: 1.2 },
    },
  ],
  xai: [
    {
      id: "grok-4.20",
      label: "Grok 4.20",
      description: "Most capable for everyday generation.",
      pricePerMillion: { input: 2, output: 6 },
    },
  ],
  mistral: [
    {
      id: "mistral-large-latest",
      label: "Mistral Large",
      description: "Most capable for everyday generation.",
      pricePerMillion: { input: 0.68, output: 2.09 },
    },
    {
      id: "mistral-medium-latest",
      label: "Mistral Medium",
      description: "Faster and cheaper, a step down in depth.",
      pricePerMillion: { input: 1.5, output: 7.5 },
    },
  ],
};

// The first known model is what a newly saved key starts on (design 110d).
export const DEFAULT_MODEL: Record<Provider, string> = Object.fromEntries(
  PROVIDERS.map((provider) => [provider, KNOWN_MODELS[provider][0].id] as const),
) as Record<Provider, string>;

export const knownModel = (provider: Provider, id: string): KnownModel | undefined =>
  KNOWN_MODELS[provider].find((model) => model.id === id);

export const modelLabel = (provider: Provider, id: string): string => knownModel(provider, id)?.label ?? id;

// One 20-minute video, measured from the samples; one rough figure on purpose (docs/prototype/constraints.md).
export const OVERVIEW_TOKENS = { input: 5000, output: 1500 };

export const estimatedOverviewCents = (model: KnownModel): number => {
  const dollars = (OVERVIEW_TOKENS.input * model.pricePerMillion.input + OVERVIEW_TOKENS.output * model.pricePerMillion.output) / 1_000_000;
  return Math.max(1, Math.round(dollars * 100));
};
