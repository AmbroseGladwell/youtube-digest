import test from "node:test";
import assert from "node:assert/strict";
import { pluralWord, pluralise } from "./pluralise.js";

test("the word is singular for exactly one and plural for anything else, none included", () => {
  assert.equal(pluralWord(1, "min", "mins"), "min");
  assert.equal(pluralWord(0, "min", "mins"), "mins");
  assert.equal(pluralWord(13, "min", "mins"), "mins");
});

test("the word carries a verb that has to agree with it", () => {
  assert.equal(pluralWord(1, "video is", "videos are"), "video is");
  assert.equal(pluralWord(2, "video is", "videos are"), "videos are");
});

test("pluralise puts the count in front of its word", () => {
  assert.equal(pluralise(1, "minute", "minutes"), "1 minute");
  assert.equal(pluralise(47, "minute", "minutes"), "47 minutes");
});

test("a long count is grouped the way the reader reads one", () => {
  assert.equal(pluralise(1200, "hour", "hours"), "1,200 hours");
});
