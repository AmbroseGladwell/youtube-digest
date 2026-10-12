import test from "node:test";
import assert from "node:assert/strict";
import { comparedModelName, parseComparedModel } from "./ComparedModel.js";

test("a model name splits at its first colon, so a model id may hold colons of its own", () => {
  assert.deepEqual(parseComparedModel("gemini:gemini-3.8-flash"), { provider: "gemini", model: "gemini-3.8-flash" });
  assert.equal(parseComparedModel("openai:ft:gpt-6-luna:org").model, "ft:gpt-6-luna:org");
  assert.equal(comparedModelName({ provider: "anthropic", model: "claude-opus-5-5" }), "anthropic:claude-opus-5-5");
});

test("a name with no provider, or a provider we have no adapter for, is refused", () => {
  assert.throws(() => parseComparedModel("claude-opus-5-5"), /provider:model/);
  assert.throws(() => parseComparedModel("openrouter:llama-5"));
  assert.throws(() => parseComparedModel("anthropic:"), /provider:model/);
});
