import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_COMPARED_MODELS, MODEL_PRICES, costInDollars } from "./modelPrices.js";
import { parseComparedModel } from "./ComparedModel.js";

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

test("every compared model parses, and its price says when and where it was checked", () => {
  for (const name of DEFAULT_COMPARED_MODELS) {
    parseComparedModel(name);
    const price = MODEL_PRICES[name]!;
    assert.match(price.checkedOn, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(price.source, /^https:\/\//);
  }
});

test("at least six models across at least three providers, as the card's definition of done asks", () => {
  const providers = new Set(DEFAULT_COMPARED_MODELS.map((name) => parseComparedModel(name).provider));
  assert.ok(DEFAULT_COMPARED_MODELS.length >= 6);
  assert.ok(providers.size >= 3);
});
