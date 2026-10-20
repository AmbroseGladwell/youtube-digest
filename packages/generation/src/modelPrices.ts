import type { Provider } from "@overview/domain";
import { promptTokensOf, type TokenUsage } from "./TokenUsage.js";

export interface TokenPrices {
  input: number;
  cachedInput: number;
  cacheWrite: number;
  output: number;
}

export interface ModelPrice {
  perMillion: TokenPrices;
  longPrompt?: { aboveTokens: number; perMillion: TokenPrices };
  checkedOn: string;
  source: string;
}

const ANTHROPIC = "https://platform.claude.com/docs/en/about-claude/pricing";
const OPENAI = "https://developers.openai.com/api/docs/pricing";
const GEMINI = "https://ai.google.dev/gemini-api/docs/pricing";
const CHECKED_ON = "2026-10-12";

export const MODEL_PRICES: Record<string, ModelPrice> = {
  "anthropic:claude-opus-5-5": {
    perMillion: { input: 4, cachedInput: 0.2, cacheWrite: 5, output: 20 },
    checkedOn: CHECKED_ON,
    source: ANTHROPIC,
  },
  "anthropic:claude-sonnet-5-5": {
    perMillion: { input: 2, cachedInput: 0.1, cacheWrite: 2.5, output: 10 },
    checkedOn: CHECKED_ON,
    source: ANTHROPIC,
  },
  "anthropic:claude-haiku-5-5": {
    perMillion: { input: 0.1, cachedInput: 0.01, cacheWrite: 0.125, output: 0.5 },
    longPrompt: { aboveTokens: 100_000, perMillion: { input: 0.5, cachedInput: 0.05, cacheWrite: 0.625, output: 2.5 } },
    checkedOn: CHECKED_ON,
    source: ANTHROPIC,
  },
  "openai:gpt-6.1-sol": {
    perMillion: { input: 2, cachedInput: 0.1, cacheWrite: 2, output: 10 },
    checkedOn: CHECKED_ON,
    source: OPENAI,
  },
  "openai:gpt-6-luna": {
    perMillion: { input: 0.1, cachedInput: 0.01, cacheWrite: 0.1, output: 0.5 },
    checkedOn: CHECKED_ON,
    source: OPENAI,
  },
  "gemini:gemini-3.1-pro-preview": {
    perMillion: { input: 2, cachedInput: 0.2, cacheWrite: 2, output: 12 },
    longPrompt: { aboveTokens: 200_000, perMillion: { input: 4, cachedInput: 0.4, cacheWrite: 4, output: 18 } },
    checkedOn: CHECKED_ON,
    source: GEMINI,
  },
  "gemini:gemini-3.8-flash": {
    perMillion: { input: 0.75, cachedInput: 0.075, cacheWrite: 0.75, output: 3.75 },
    checkedOn: CHECKED_ON,
    source: GEMINI,
  },
  "gemini:gemini-3.6-flash": {
    perMillion: { input: 0.75, cachedInput: 0.075, cacheWrite: 0.75, output: 3.75 },
    checkedOn: CHECKED_ON,
    source: GEMINI,
  },
};

export const priceOf = ({ provider, model }: { provider: Provider; model: string }): ModelPrice | undefined =>
  MODEL_PRICES[`${provider}:${model}`];

export function costInDollars(price: ModelPrice, usage: TokenUsage): number {
  const { perMillion } =
    price.longPrompt !== undefined && promptTokensOf(usage) > price.longPrompt.aboveTokens ? price.longPrompt : price;
  return (
    (usage.uncachedInputTokens * perMillion.input +
      usage.cachedInputTokens * perMillion.cachedInput +
      usage.cacheWriteTokens * perMillion.cacheWrite +
      usage.outputTokens * perMillion.output) /
    1_000_000
  );
}
