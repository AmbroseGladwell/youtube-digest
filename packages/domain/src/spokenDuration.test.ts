import test from "node:test";
import assert from "node:assert/strict";
import { spokenDuration } from "./spokenDuration.js";

test("says minutes and the seconds after them", () => {
  assert.equal(spokenDuration(750_000), "12 minutes 30");
  assert.equal(spokenDuration(61_000), "1 minute 1");
});

test("says whole minutes and short spans on their own", () => {
  assert.equal(spokenDuration(720_000), "12 minutes");
  assert.equal(spokenDuration(45_000), "45 seconds");
  assert.equal(spokenDuration(0), "0 seconds");
});

test("says hours when the moment is past one", () => {
  assert.equal(spokenDuration(3_930_000), "1 hour 5 minutes 30");
  assert.equal(spokenDuration(3_630_000), "1 hour and 30 seconds");
  assert.equal(spokenDuration(7_200_000), "2 hours");
});
