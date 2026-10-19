import type { Provider } from "@overview/domain";

export interface TokenUsage {
  uncachedInputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
}

export const promptTokensOf = (usage: TokenUsage): number =>
  usage.uncachedInputTokens + usage.cachedInputTokens + usage.cacheWriteTokens;

const count = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);

type Body = Record<string, unknown> | undefined;
const field = (body: Body, key: string): Body =>
  typeof body?.[key] === "object" && body[key] !== null ? (body[key] as Record<string, unknown>) : undefined;

export function tokenUsageOf(provider: Provider, body: unknown): TokenUsage | null {
  const root = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : undefined;

  if (provider === "anthropic") {
    const usage = field(root, "usage");
    if (usage === undefined) return null;
    return {
      uncachedInputTokens: count(usage.input_tokens),
      cachedInputTokens: count(usage.cache_read_input_tokens),
      cacheWriteTokens: count(usage.cache_creation_input_tokens),
      outputTokens: count(usage.output_tokens),
    };
  }

  if (provider === "gemini") {
    const usage = field(root, "usageMetadata");
    if (usage === undefined) return null;
    const cached = count(usage.cachedContentTokenCount);
    return {
      uncachedInputTokens: count(usage.promptTokenCount) - cached,
      cachedInputTokens: cached,
      cacheWriteTokens: 0,
      outputTokens: count(usage.candidatesTokenCount) + count(usage.thoughtsTokenCount),
    };
  }

  const usage = field(root, "usage");
  if (usage === undefined) return null;
  const cached = count(field(usage, "prompt_tokens_details")?.cached_tokens ?? usage.prompt_cache_hit_tokens);
  return {
    uncachedInputTokens: count(usage.prompt_tokens) - cached,
    cachedInputTokens: cached,
    cacheWriteTokens: 0,
    outputTokens: count(usage.completion_tokens),
  };
}
