import test from "node:test";
import assert from "node:assert/strict";
import { modelFor } from "./ModelByProvider.js";
import { DEFAULT_MODEL, KNOWN_MODELS, estimatedOverviewCents, modelLabel } from "./KnownModel.js";
import { PROVIDERS } from "./Provider.js";

test("a provider with no model chosen falls back to the one we would have picked", () => {
  assert.equal(modelFor({}, "openai"), DEFAULT_MODEL.openai);
});

test("a chosen model wins over the fallback", () => {
  assert.equal(modelFor({ openai: "gpt-6-luna" }, "openai"), "gpt-6-luna");
});

test("one provider's choice never answers for another", () => {
  assert.equal(modelFor({ openai: "gpt-6-luna" }, "gemini"), DEFAULT_MODEL.gemini);
});

test("every provider has a fallback list, because it is what the picker shows when a provider will not list its own", () => {
  for (const provider of PROVIDERS) {
    assert.ok(KNOWN_MODELS[provider].length > 0, provider);
  }
});

test("every provider's default is one of its own known models", () => {
  for (const provider of PROVIDERS) {
    assert.ok(
      KNOWN_MODELS[provider].some((model) => model.id === DEFAULT_MODEL[provider]),
      provider,
    );
  }
});

test("a model we know is called by its name, and one we do not by the id the provider lists it under", () => {
  assert.equal(modelLabel("openai", "gpt-6-luna"), "GPT-6 Luna");
  assert.equal(modelLabel("openai", "gpt-4.1-mini"), "gpt-4.1-mini");
});

test("the rough cost of an overview is whole cents, and never rounds a real cost away to nothing", () => {
  const cheapest = { id: "x", label: "X", description: "", pricePerMillion: { input: 0.01, output: 0.01 } };

  assert.equal(estimatedOverviewCents(cheapest), 1);
  assert.equal(estimatedOverviewCents(KNOWN_MODELS.anthropic[0]), 5);
});
