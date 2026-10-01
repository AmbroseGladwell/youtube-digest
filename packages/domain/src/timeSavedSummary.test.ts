import test from "node:test";
import assert from "node:assert/strict";
import { makeOverview } from "./OverviewFactory.testHelper.js";
import type { Overview } from "./Overview.js";
import { overviewTimeSaved, timeSavedSummary } from "./timeSavedSummary.js";

const minutesAndSeconds = (minutes: number, seconds = 0) => (minutes * 60 + seconds) * 1000;

const lasting = (durationMs: number | null, overrides: Partial<Overview> = {}): Overview =>
  makeOverview({ video: { ...makeOverview().video, durationMs }, ...overrides });

const read = (overview: Overview) => ({ overview, state: { read: true } });
const unread = (overview: Overview) => ({ overview, state: { read: false } });

test("an overview saves its video's length less the minute it takes to read, in whole minutes", () => {
  assert.deepEqual(overviewTimeSaved(lasting(minutesAndSeconds(14, 2))), { kind: "counted", minutes: 13, lessPartToWatch: false });
});

test("a note that takes longer to read than its video saved nothing, rather than a negative", () => {
  assert.deepEqual(overviewTimeSaved(lasting(minutesAndSeconds(0, 40))), { kind: "counted", minutes: 0, lessPartToWatch: false });
});

test("an overview with no video length is left out rather than estimated", () => {
  assert.deepEqual(overviewTimeSaved(lasting(null)), { kind: "withoutLength" });
});

test("an overview whose verdict says to watch it saved nothing and is left out", () => {
  const watch = lasting(minutesAndSeconds(30), {
    watchAnyway: { answer: "yes", reason: "The demo is the point.", range: null },
  });

  assert.deepEqual(overviewTimeSaved(watch), { kind: "watchVerdict" });
});

test("an overview whose verdict says to watch part of it does not count that part", () => {
  const partial = lasting(minutesAndSeconds(30), {
    watchAnyway: {
      answer: "partial",
      reason: "Watch the demo.",
      range: { startMs: minutesAndSeconds(10), endMs: minutesAndSeconds(18) },
    },
  });

  assert.deepEqual(overviewTimeSaved(partial), { kind: "counted", minutes: 21, lessPartToWatch: true });
});

test("only overviews marked read count towards the total", () => {
  const summary = timeSavedSummary([read(lasting(minutesAndSeconds(11))), unread(lasting(minutesAndSeconds(60)))]);

  assert.deepEqual(summary, { minutes: 10, counted: 1, lessPartToWatch: 0, withoutLength: 0, watchVerdict: 0 });
});

test("the summary says how many read overviews it left out, and why", () => {
  const summary = timeSavedSummary([
    read(lasting(minutesAndSeconds(31))),
    read(lasting(minutesAndSeconds(22))),
    read(lasting(null)),
    read(lasting(null)),
    unread(lasting(null)),
    read(lasting(minutesAndSeconds(40), { watchAnyway: { answer: "yes", reason: "x", range: null } })),
  ]);

  assert.deepEqual(summary, { minutes: 51, counted: 2, lessPartToWatch: 0, withoutLength: 2, watchVerdict: 1 });
});

test("an empty library has saved nothing and left nothing out", () => {
  assert.deepEqual(timeSavedSummary([]), { minutes: 0, counted: 0, lessPartToWatch: 0, withoutLength: 0, watchVerdict: 0 });
});
