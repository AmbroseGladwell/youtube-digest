import test from "node:test";
import assert from "node:assert/strict";
import { armCost, breakEvenReaders, hybridCostPerReader } from "./costModelMarkdown.js";
import { makeFetchedTranscript } from "./FetchedTranscriptFactory.testHelper.js";
import { makeRunRecord } from "./RunRecordFactory.testHelper.js";

test("the hybrid pays for itself once enough readers share the first stage", () => {
  assert.equal(breakEvenReaders(3, 1, 4), 1);
  assert.equal(breakEvenReaders(4, 1, 3), 2);
});

test("a personal pass that costs as much as a single pass never pays for itself", () => {
  assert.equal(breakEvenReaders(3, 4, 4), null);
});

test("each reader pays a share of the first stage plus their own pass", () => {
  assert.equal(hybridCostPerReader(3, 1, 3), 2);
});

test("an arm's cost counts only the videos every arm passed", () => {
  const fetched = makeFetchedTranscript(40);
  const transcripts = new Map([["video-one", fetched], ["video-two", fetched]]);
  const records = [
    makeRunRecord({ videoId: "video-one", costDollars: 0.02 }),
    makeRunRecord({ videoId: "video-two", costDollars: 0.5 }),
  ];

  const cost = armCost(records, new Set(["video-one"]), transcripts);

  assert.equal(cost.videos, 1);
  assert.equal(cost.meanCostDollars, 0.02);
  assert.equal(cost.costPerTwentyMinutesDollars, 0.02);
});
