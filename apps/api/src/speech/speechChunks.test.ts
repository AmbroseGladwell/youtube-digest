import test from "node:test";
import assert from "node:assert/strict";
import { speechChunks } from "./speechChunks.js";

test("the first sentence goes alone and the rest in threes", () => {
  assert.deepEqual(speechChunks([1, 2, 3, 4, 5, 6]), [[1], [2, 3, 4], [5, 6]]);
});

test("nothing to say makes no chunks", () => {
  assert.deepEqual(speechChunks([]), []);
});
