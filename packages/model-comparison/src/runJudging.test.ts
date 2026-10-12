import test from "node:test";
import assert from "node:assert/strict";
import { VideoId } from "@overview/domain";
import type { RecordStore } from "./jsonRecordStore.js";
import type { JudgePairOptions } from "./judgePair.js";
import type { JudgeRecord } from "./JudgeRecord.js";
import { judgingPairs, runJudging } from "./runJudging.js";
import { makeFetchedTranscript } from "./FetchedTranscriptFactory.testHelper.js";
import { makeOverview } from "./OverviewFactory.testHelper.js";
import { makeRunRecord } from "./RunRecordFactory.testHelper.js";

const BASELINE = "anthropic:claude-opus-5-5";
const transcripts = new Map(["a", "b"].map((id) => [id, makeFetchedTranscript(10, { id: VideoId.parse(id) })]));
const overview = makeOverview();
const run = (model: string, videoId: string, outcome: "passed-first" | "failed" = "passed-first") => {
  const [provider, name] = model.split(":") as ["anthropic" | "openai" | "gemini", string];
  return makeRunRecord({ provider, model: name, videoId, outcome, overview: outcome === "failed" ? null : overview });
};

test("a pair needs both the baseline and the candidate to have passed on the same video", () => {
  const pairs = judgingPairs(
    [
      run(BASELINE, "a"),
      run(BASELINE, "b", "failed"),
      run("openai:gpt-6-luna", "a"),
      run("openai:gpt-6-luna", "b"),
      run("gemini:gemini-3.8-flash", "a", "failed"),
    ],
    transcripts,
    BASELINE,
  );

  assert.deepEqual(
    pairs.map((pair) => `${pair.candidate.name} ${pair.fetched.video.id}`),
    ["openai:gpt-6-luna a"],
  );
});

function memoryStore(previous: JudgeRecord[] = []): RecordStore<JudgeRecord> & { saved: JudgeRecord[] } {
  const saved: JudgeRecord[] = [];
  return { saved, all: async () => previous, save: async (record) => void saved.push(record) };
}

const judged = (candidate: string, videoId: string, outcome: JudgeRecord["outcome"], costDollars = 0.03): JudgeRecord => ({
  videoId,
  baseline: BASELINE,
  candidate,
  judge: "openai:gpt-6.1-sol",
  candidateIsA: true,
  judgedAt: "2026-10-12T12:00:00.000Z",
  outcome,
  error: null,
  answer: null,
  results: null,
  calls: [],
  latencyMs: 1000,
  costDollars,
});

const allPairs = judgingPairs(
  ["a", "b"].flatMap((video) => [BASELINE, "openai:gpt-6-luna", "anthropic:claude-haiku-5-5", "gemini:gemini-3.8-flash"].map((model) => run(model, video))),
  transcripts,
  BASELINE,
);

test("settled judgments are not paid for twice, errored ones are, and a judge with no key is skipped", async () => {
  const asked: string[] = [];
  const lines: string[] = [];
  const store = memoryStore([
    judged("anthropic:claude-haiku-5-5", "a", "judged"),
    judged("gemini:gemini-3.8-flash", "a", "errored", 0),
  ]);

  const outcome = await runJudging({
    pairs: allPairs,
    keys: { openai: "sk" },
    budgetDollars: 10,
    store,
    judgePair: async ({ candidate, fetched }: JudgePairOptions) => {
      asked.push(`${candidate.name} ${fetched.video.id}`);
      return judged(candidate.name, fetched.video.id!, "judged");
    },
    log: (line) => lines.push(line),
  });

  assert.deepEqual(asked.sort(), ["anthropic:claude-haiku-5-5 b", "gemini:gemini-3.8-flash a", "gemini:gemini-3.8-flash b"]);
  assert.equal(outcome.skipped, 1);
  assert.match(lines.join("\n"), /gemini:gemini-3.1-pro-preview: no gemini key/);
});

test("judging stops at the budget, counting what judging this run has already spent", async () => {
  const asked: string[] = [];
  const outcome = await runJudging({
    pairs: allPairs,
    keys: { openai: "sk", gemini: "g" },
    budgetDollars: 0.1,
    store: memoryStore([judged("anthropic:claude-haiku-5-5", "elsewhere", "judged", 0.05)]),
    judgePair: async ({ candidate, fetched }: JudgePairOptions) => {
      asked.push(candidate.name);
      return judged(candidate.name, fetched.video.id!, "judged", 0.04);
    },
    log: () => {},
  });

  assert.equal(outcome.stoppedForBudget, true);
  assert.ok(outcome.spentDollars >= 0.1);
  assert.ok(asked.length < allPairs.length);
});
