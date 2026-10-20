import test from "node:test";
import assert from "node:assert/strict";
import { MODEL_PRICES, costInDollars, priceOf } from "./modelPrices.js";

const usage = { uncachedInputTokens: 1_000_000, cachedInputTokens: 1_000_000, cacheWriteTokens: 0, outputTokens: 1_000_000 };

test("each kind of token is charged at its own rate", () => {
  assert.equal(costInDollars(MODEL_PRICES["anthropic:claude-opus-5-5"]!, usage), 4 + 0.2 + 20);
});

test("a prompt over a model's long-prompt threshold is charged entirely at the higher rate", () => {
  const haiku = MODEL_PRICES["anthropic:claude-haiku-5-5"]!;
  const short = { uncachedInputTokens: 100_000, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 0 };
  const long = { ...short, uncachedInputTokens: 100_001 };

  assert.equal(costInDollars(haiku, short), 0.01);
  assert.equal(costInDollars(haiku, long), (100_001 * 0.5) / 1_000_000);
});

test("a model is priced by its provider and name together", () => {
  assert.equal(priceOf({ provider: "openai", model: "gpt-6.1-sol" }), MODEL_PRICES["openai:gpt-6.1-sol"]);
  assert.equal(priceOf({ provider: "anthropic", model: "gpt-6.1-sol" }), undefined);
});

test("every price says when and where it was checked", () => {
  for (const price of Object.values(MODEL_PRICES)) {
    assert.match(price.checkedOn, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(price.source, /^https:\/\//);
  }
});
