import test from "node:test";
import assert from "node:assert/strict";
import { listenPairs, nextListenPair, preferenceOf } from "./listenPairs.js";
import type { ListenPick } from "./ListenPick.js";
import { makeOverview } from "./OverviewFactory.testHelper.js";
import { makeRunRecord } from "./RunRecordFactory.testHelper.js";

const overview = makeOverview();

test("a source is paired only when both runs passed it, in the order given", () => {
  const oldRuns = [
    makeRunRecord({ videoId: "long", overview }),
    makeRunRecord({ videoId: "short", overview }),
    makeRunRecord({ videoId: "failed-new", overview }),
  ];
  const newRuns = [
    makeRunRecord({ videoId: "short", overview }),
    makeRunRecord({ videoId: "long", overview }),
    makeRunRecord({ videoId: "failed-new", outcome: "failed", overview: null }),
  ];

  assert.deepEqual(
    listenPairs(oldRuns, newRuns, ["short", "long", "failed-new", "never-run"]).map((pair) => pair.videoId),
    ["short", "long"],
  );
});

test("a source run twice is paired on its latest passing note", () => {
  const earlier = makeOverview({ inOneLine: "The earlier write." });
  const later = makeOverview({ inOneLine: "The later write." });
  const newRuns = [
    makeRunRecord({ videoId: "a", startedAt: "2026-11-13T10:00:00.000Z", overview: later }),
    makeRunRecord({ videoId: "a", startedAt: "2026-11-13T09:00:00.000Z", overview: earlier }),
  ];

  assert.equal(listenPairs([makeRunRecord({ videoId: "a", overview })], newRuns, ["a"])[0]?.new.inOneLine, "The later write.");
});

test("a pair already picked is not offered again", () => {
  const pairs = listenPairs(
    [makeRunRecord({ videoId: "a", overview }), makeRunRecord({ videoId: "b", overview })],
    [makeRunRecord({ videoId: "a", overview }), makeRunRecord({ videoId: "b", overview })],
    ["a", "b"],
  );
  const pickedA = { videoId: "a" } as ListenPick;

  assert.equal(nextListenPair(pairs, [pickedA])?.videoId, "b");
  assert.equal(nextListenPair(pairs, [pickedA, { videoId: "b" } as ListenPick]), null);
});

test("the side picked is turned back into old or new by where new was placed", () => {
  assert.equal(preferenceOf("A", true), "new");
  assert.equal(preferenceOf("A", false), "old");
  assert.equal(preferenceOf("B", true), "old");
  assert.equal(preferenceOf("B", false), "new");
  assert.equal(preferenceOf("tie", true), "tie");
});
