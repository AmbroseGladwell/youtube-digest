import test from "node:test";
import assert from "node:assert/strict";
import { VideoId } from "@overview/domain";
import { summariseRuns } from "./summariseRuns.js";
import { makeFetchedTranscript } from "./FetchedTranscriptFactory.testHelper.js";
import { makeGeneratedOutput } from "./GeneratedOutputFactory.testHelper.js";
import { makeRunRecord } from "./RunRecordFactory.testHelper.js";

const tenMinutes = makeFetchedTranscript(20, { id: VideoId.parse("ten") });
const thirtyMinutes = makeFetchedTranscript(60, { id: VideoId.parse("thirty") });
const transcripts = new Map([
  ["ten", tenMinutes],
  ["thirty", thirtyMinutes],
]);

test("a model's runs are counted by outcome, with latency taken from the ones that passed", () => {
  const [summary] = summariseRuns(
    [
      makeRunRecord({ videoId: "ten", outcome: "passed-first", latencyMs: 2000, costDollars: 0.02 }),
      makeRunRecord({ videoId: "thirty", outcome: "passed-after-retry", latencyMs: 6000, costDollars: 0.1 }),
      makeRunRecord({ videoId: "ten", outcome: "failed", latencyMs: 90_000, costDollars: 0.04, attempts: [] }),
      makeRunRecord({ videoId: "thirty", outcome: "errored", latencyMs: 100, costDollars: 0, attempts: [] }),
    ],
    transcripts,
  );

  assert.equal(summary?.name, "anthropic:claude-opus-5-5");
  assert.deepEqual(
    [summary?.runs, summary?.passedFirst, summary?.passedAfterRetry, summary?.failed, summary?.errored],
    [4, 1, 1, 1, 1],
  );
  assert.equal(summary?.medianLatencyMs, 4000);
});

test("cost per twenty minutes weighs what was spent by how much video it covered", () => {
  const [summary] = summariseRuns(
    [
      makeRunRecord({ videoId: "ten", costDollars: 0.02 }),
      makeRunRecord({ videoId: "thirty", costDollars: 0.1 }),
    ],
    transcripts,
  );

  assert.ok(Math.abs(summary!.meanCostDollars! - 0.06) < 1e-9);
  assert.ok(Math.abs(summary!.costPerTwentyMinutesDollars! - 0.06) < 1e-9);
  assert.ok(Math.abs(summary!.totalCostDollars - 0.12) < 1e-9);
});

test("checks are tallied per model over the overviews that passed", () => {
  const withEmDash = makeGeneratedOutput({ coreClaim: "Planning meals — and store brands — cut the bill." });
  const [summary] = summariseRuns(
    [
      makeRunRecord({ videoId: "ten", attempts: [makeGeneratedOutput()] }),
      makeRunRecord({ videoId: "thirty", attempts: [withEmDash] }),
      makeRunRecord({ videoId: "ten", outcome: "failed", attempts: [withEmDash] }),
    ],
    transcripts,
  );

  assert.deepEqual(summary?.checks.noEmDash, { area: "overview", passed: 1, total: 2 });
  assert.equal(summary?.checks.chaptersSpreadAcrossVideo?.area, "chapters");
});

test("an unpriced run is counted apart rather than averaged in as free", () => {
  const [summary] = summariseRuns(
    [makeRunRecord({ videoId: "ten", costDollars: null }), makeRunRecord({ videoId: "thirty", costDollars: 0.1 })],
    transcripts,
  );

  assert.equal(summary?.unpricedRuns, 1);
  assert.equal(summary?.meanCostDollars, 0.1);
});
