import test from "node:test";
import assert from "node:assert/strict";
import { tagUsage } from "./tagUsage.js";

test("tags are counted once per note, most used first and then A–Z", () => {
  assert.deepEqual(tagUsage([["saas", "pricing"], ["saas", "saas"], ["ai"]]), [
    { tag: "saas", count: 2 },
    { tag: "ai", count: 1 },
    { tag: "pricing", count: 1 },
  ]);
});

test("an empty library has no tags", () => {
  assert.deepEqual(tagUsage([]), []);
});
