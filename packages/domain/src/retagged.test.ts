import test from "node:test";
import assert from "node:assert/strict";
import { retagged } from "./retagged.js";

test("merged tags become the kept one, in place, without repeating it", () => {
  assert.deepEqual(retagged(["ai-saas", "pricing", "saas"], new Set(["ai-saas"]), "saas"), ["saas", "pricing"]);
});

test("a deleted tag is taken off", () => {
  assert.deepEqual(retagged(["nuclear", "energy"], new Set(["nuclear"]), null), ["energy"]);
});

test("a note without the tag is unchanged", () => {
  assert.deepEqual(retagged(["energy"], new Set(["nuclear"]), "power"), ["energy"]);
});
