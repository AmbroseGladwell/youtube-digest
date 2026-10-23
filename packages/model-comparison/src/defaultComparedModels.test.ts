import test from "node:test";
import assert from "node:assert/strict";
import { parseComparedModel } from "./ComparedModel.js";
import { DEFAULT_COMPARED_MODELS } from "./defaultComparedModels.js";

test("every compared model parses as provider:model", () => {
  for (const name of DEFAULT_COMPARED_MODELS) parseComparedModel(name);
});

test("at least six models across at least three providers, as the card's definition of done asks", () => {
  const providers = new Set(DEFAULT_COMPARED_MODELS.map((name) => parseComparedModel(name).provider));
  assert.ok(DEFAULT_COMPARED_MODELS.length >= 6);
  assert.ok(providers.size >= 3);
});
