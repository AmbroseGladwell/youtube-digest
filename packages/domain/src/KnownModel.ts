import { PROVIDERS, type Provider } from "./Provider.js";

// A model we have actually pointed at a transcript, so it can carry a description and a
// rough price. Everything else a reader's key can reach is offered too, by its raw id and
// with neither (design 110e). This list is a floor, not the catalogue: the real list is
// fetched from the provider with the reader's own key, and this is what the picker falls
// back to when that call fails (design 110h).
//
// Ids checked against each provider's own documentation on 11 October 2026. Prices are
// approximate, per million tokens, in US dollars — the currency all six price and bill in.
// They exist only to drive the one rough figure the picker shows, never to bill anyone.
export interface KnownModel {
  id: string;
  label: string;
  description: string;
  pricePerMillion: { input: number; output: number };
}

// A non-empty tuple per provider, so that the fallback list cannot be emptied: it is what
// the picker shows when the provider will not list its own models.
export const KNOWN_MODELS: Record<Provider, readonly [KnownModel, ...KnownModel[]]> = {
  anthropic: [
    {
      id: "claude-opus-5-5",
      label: "Claude Opus 5.5",
      description: "Most capable for everyday generation.",
      pricePerMillion: { input: 4, output: 20 },
    },
    {
      id: "claude-sonnet-5-5",
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

// The first of each provider's known models is what a newly saved key starts on, so a
// reader who never opens the picker is on the one we would have recommended (design 110d,
// "we picked GPT-5.1 to start").
export const DEFAULT_MODEL: Record<Provider, string> = Object.fromEntries(
  PROVIDERS.map((provider) => [provider, KNOWN_MODELS[provider][0].id] as const),
) as Record<Provider, string>;

export const knownModel = (provider: Provider, id: string): KnownModel | undefined =>
  KNOWN_MODELS[provider].find((model) => model.id === id);

// What a model is called when it has a name we know, and its raw id when it does not — the
// id is what the provider itself lists it under (design 110e).
export const modelLabel = (provider: Provider, id: string): string =>
  knownModel(provider, id)?.label ?? id;

// One 20-minute video: a transcript of roughly 3,000 words with the prompt around it, and
// an overview of roughly 1,100 words back. Measured from the samples rather than guessed,
// and deliberately one number rather than a per-video calculation — the figure is
// introduced as "roughly" and a precise-looking one would be a lie
// (CLAUDE.md, "Never let a model count, measure or time anything").
export const OVERVIEW_TOKENS = { input: 5000, output: 1500 };

export function estimatedOverviewCents(model: KnownModel): number {
  const dollars =
    (OVERVIEW_TOKENS.input * model.pricePerMillion.input +
      OVERVIEW_TOKENS.output * model.pricePerMillion.output) /
    1_000_000;
  return Math.max(1, Math.round(dollars * 100));
}
