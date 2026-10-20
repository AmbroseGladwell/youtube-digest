import test from "node:test";
import assert from "node:assert/strict";
import { nextUsageMonth, secondsToNextUsageMonth, usageMonth } from "./usageMonth.js";

test("a month is the UTC calendar month, whatever the reader's own clock says", () => {
  const lastMinuteOfOctoberUtc = new Date("2026-10-31T23:59:00.000Z");

  assert.equal(usageMonth(lastMinuteOfOctoberUtc), "2026-10-01");
  assert.equal(usageMonth(new Date("2026-11-01T00:00:00.000Z")), "2026-11-01");
});

test("the reset is the first of the next month, across a year end", () => {
  assert.equal(nextUsageMonth(new Date("2026-12-15T12:00:00.000Z")), "2027-01-01");
});

test("the wait until the reset is counted to UTC midnight on the first", () => {
  assert.equal(secondsToNextUsageMonth(new Date("2026-10-31T23:59:00.000Z")), 60);
});
