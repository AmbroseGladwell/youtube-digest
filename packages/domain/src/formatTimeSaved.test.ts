import test from "node:test";
import assert from "node:assert/strict";
import { formatTimeSaved, spokenTimeSaved } from "./formatTimeSaved.js";

test("under an hour the figure is minutes alone", () => {
  assert.equal(formatTimeSaved(0), "0m");
  assert.equal(formatTimeSaved(32), "32m");
});

test("from an hour the minutes always take two digits, like a counter", () => {
  assert.equal(formatTimeSaved(63), "1h 03m");
  assert.equal(formatTimeSaved(587), "9h 47m");
  assert.equal(formatTimeSaved(6004), "100h 04m");
});

test("the spoken figure names its units in full and in the singular where it should", () => {
  assert.equal(spokenTimeSaved(1), "1 minute");
  assert.equal(spokenTimeSaved(60), "1 hour");
  assert.equal(spokenTimeSaved(61), "1 hour 1 minute");
  assert.equal(spokenTimeSaved(587), "9 hours 47 minutes");
});
