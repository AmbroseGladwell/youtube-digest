import test from "node:test";
import assert from "node:assert/strict";
import { canWriteAnOverview, usableModels } from "./usableModels.js";

test("the models that cannot write prose are the ones dropped", () => {
  assert.equal(canWriteAnOverview("text-embedding-3-large"), false);
  assert.equal(canWriteAnOverview("whisper-1"), false);
  assert.equal(canWriteAnOverview("dall-e-3"), false);
  assert.equal(canWriteAnOverview("gpt-4o-audio-preview"), false);
  assert.equal(canWriteAnOverview("omni-moderation-latest"), false);
});

test("a model we have never heard of is offered rather than hidden, because the cost of hiding it is higher", () => {
  assert.equal(canWriteAnOverview("gpt-9-unreleased"), true);
  assert.equal(canWriteAnOverview("some-new-thing"), true);
});

test("the ones dropped are counted, because the picker says how many it is not showing", () => {
  const listing = usableModels(["gpt-6.1-sol", "text-embedding-3-small", "whisper-1", "gpt-6-luna"]);

  assert.deepEqual(listing.usable, ["gpt-6-luna", "gpt-6.1-sol"]);
  assert.equal(listing.unusable, 2);
});

test("a provider listing the same model twice does not make it two rows", () => {
  const listing = usableModels(["gpt-6-luna", "gpt-6-luna"]);

  assert.deepEqual(listing.usable, ["gpt-6-luna"]);
  assert.equal(listing.unusable, 0);
});
