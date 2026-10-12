import test from "node:test";
import assert from "node:assert/strict";
import { promptTokensOf, tokenUsageOf } from "./TokenUsage.js";

test("Anthropic's usage keeps cache reads and writes apart from uncached input", () => {
  const usage = tokenUsageOf("anthropic", {
    content: [],
    usage: { input_tokens: 900, cache_read_input_tokens: 3000, cache_creation_input_tokens: 100, output_tokens: 1400 },
  });

  assert.deepEqual(usage, { uncachedInputTokens: 900, cachedInputTokens: 3000, cacheWriteTokens: 100, outputTokens: 1400 });
  assert.equal(promptTokensOf(usage!), 4000);
});

test("OpenAI counts cached tokens inside prompt_tokens, so they are taken back out", () => {
  const usage = tokenUsageOf("openai", {
    choices: [],
    usage: { prompt_tokens: 5000, completion_tokens: 1500, prompt_tokens_details: { cached_tokens: 4096 } },
  });

  assert.deepEqual(usage, { uncachedInputTokens: 904, cachedInputTokens: 4096, cacheWriteTokens: 0, outputTokens: 1500 });
});

test("DeepSeek's cache hits are read from its own field", () => {
  const usage = tokenUsageOf("deepseek", {
    usage: { prompt_tokens: 5000, completion_tokens: 1500, prompt_cache_hit_tokens: 1000 },
  });

  assert.equal(usage?.cachedInputTokens, 1000);
  assert.equal(usage?.uncachedInputTokens, 4000);
});

test("Gemini's thinking tokens are billed as output, and cached content is counted within the prompt", () => {
  const usage = tokenUsageOf("gemini", {
    candidates: [],
    usageMetadata: { promptTokenCount: 5000, cachedContentTokenCount: 2000, candidatesTokenCount: 1500, thoughtsTokenCount: 800 },
  });

  assert.deepEqual(usage, { uncachedInputTokens: 3000, cachedInputTokens: 2000, cacheWriteTokens: 0, outputTokens: 2300 });
});

test("a response with no usage reports none rather than zero, so its cost cannot pass as free", () => {
  assert.equal(tokenUsageOf("anthropic", { content: [] }), null);
  assert.equal(tokenUsageOf("gemini", { candidates: [] }), null);
  assert.equal(tokenUsageOf("openai", undefined), null);
});
