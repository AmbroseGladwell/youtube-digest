import test from "node:test";
import assert from "node:assert/strict";
import { VideoId } from "@overview/domain";
import { runComparison, type RunStore } from "./runComparison.js";
import type { RunOneOptions } from "./runOne.js";
import type { RunRecord } from "./RunRecord.js";
import { makeFetchedTranscript } from "./FetchedTranscriptFactory.testHelper.js";
import { makeRunRecord } from "./RunRecordFactory.testHelper.js";

const opus = { provider: "anthropic" as const, model: "claude-opus-5-5" };
const luna = { provider: "openai" as const, model: "gpt-6-luna" };
const videos = ["a", "b", "c"].map((id) => makeFetchedTranscript(10, { id: VideoId.parse(id) }));

function memoryStore(previous: RunRecord[] = []): RunStore & { saved: RunRecord[] } {
  const saved: RunRecord[] = [];
  return { saved, all: async () => previous, save: async (record) => void saved.push(record) };
}

const costing = (dollars: number) => {
  const ran: string[] = [];
  const runOne = async ({ model, fetched }: RunOneOptions) => {
    ran.push(`${model.model}:${fetched.video.id}`);
    return makeRunRecord({ provider: model.provider, model: model.model, videoId: fetched.video.id!, costDollars: dollars });
  };
  return { ran, runOne };
};

const options = { keys: { anthropic: "k", openai: "k" }, transcripts: videos, log: () => {} };

test("every model runs every video, and each record is saved", async () => {
  const { ran, runOne } = costing(0.01);
  const store = memoryStore();

  const outcome = await runComparison({ ...options, models: [opus, luna], budgetDollars: 10, store, runOne });

  assert.equal(outcome.ran, 6);
  assert.equal(store.saved.length, 6);
  assert.deepEqual(ran.filter((run) => run.startsWith("gpt")), ["gpt-6-luna:a", "gpt-6-luna:b", "gpt-6-luna:c"]);
});

test("a settled run is not paid for twice, but an errored one is tried again", async () => {
  const { ran, runOne } = costing(0.01);
  const store = memoryStore([
    makeRunRecord({ videoId: "a", outcome: "passed-first" }),
    makeRunRecord({ videoId: "b", outcome: "failed" }),
    makeRunRecord({ videoId: "c", outcome: "errored", costDollars: 0 }),
  ]);

  const outcome = await runComparison({ ...options, models: [opus], budgetDollars: 10, store, runOne });

  assert.deepEqual(ran, ["claude-opus-5-5:c"]);
  assert.equal(outcome.skipped, 2);
});

test("the run stops once measured spend, including earlier runs of the same name, reaches the budget", async () => {
  const { ran, runOne } = costing(0.4);
  const store = memoryStore([makeRunRecord({ videoId: "elsewhere", costDollars: 0.5 })]);

  const outcome = await runComparison({ ...options, models: [opus], budgetDollars: 1, store, runOne });

  assert.deepEqual(ran, ["claude-opus-5-5:a", "claude-opus-5-5:b"]);
  assert.equal(outcome.stoppedForBudget, true);
  assert.ok(Math.abs(outcome.spentDollars - 1.3) < 1e-9);
});

test("a model with no key or no price is skipped out loud, never run", async () => {
  const { ran, runOne } = costing(0.01);
  const lines: string[] = [];

  await runComparison({
    ...options,
    keys: { anthropic: "k" },
    models: [luna, { provider: "anthropic", model: "claude-unlisted" }],
    budgetDollars: 10,
    store: memoryStore(),
    runOne,
    log: (line) => lines.push(line),
  });

  assert.deepEqual(ran, []);
  assert.match(lines.join("\n"), /openai:gpt-6-luna: no openai key/);
  assert.match(lines.join("\n"), /anthropic:claude-unlisted: no price/);
});
