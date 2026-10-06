import test from "node:test";
import assert from "node:assert/strict";
import { normaliseTag } from "./normaliseTag.js";

test("a typed name is lowercased and hyphenated the way stored tags are", () => {
  assert.equal(normaliseTag("Micro SaaS tools"), "micro-saas-tools");
  assert.equal(normaliseTag("  AI_SaaS!! "), "ai-saas");
  assert.equal(normaliseTag("Café culture"), "cafe-culture");
});

test("a name with no letters or numbers has nothing to save", () => {
  assert.equal(normaliseTag("!!"), null);
  assert.equal(normaliseTag("   "), null);
});
