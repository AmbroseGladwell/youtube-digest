import test from "node:test";
import assert from "node:assert/strict";
import type { BlindPick } from "./BlindPick.js";
import type { CandidateResult, JudgeRecord } from "./JudgeRecord.js";
import { summariseJudging, winRate } from "./summariseJudging.js";

const judgment = (videoId: string, overall: CandidateResult, faithfulness: CandidateResult = overall): JudgeRecord => ({
  videoId,
  baseline: "anthropic:claude-opus-5-5",
  candidate: "openai:gpt-6-luna",
  judge: "gemini:gemini-3.1-pro-preview",
  candidateIsA: true,
  judgedAt: "now",
  outcome: "judged",
  error: null,
  answer: null,
  results: { faithfulness, verdict: "tie", howToApply: "tie", chapters: "tie", readsAloud: "tie", overall },
  calls: [],
  latencyMs: 1,
  costDollars: 0.05,
});
const pick = (videoId: string, result: CandidateResult): BlindPick => ({
  videoId,
  baseline: "anthropic:claude-opus-5-5",
  candidate: "openai:gpt-6-luna",
  candidateWasA: true,
  choice: "A",
  result,
  pickedAt: "now",
});

test("a tie is half a win, so level with the baseline is 50%", () => {
  assert.equal(winRate({ win: 1, tie: 2, loss: 1 }), 0.5);
  assert.equal(winRate({ win: 0, tie: 0, loss: 0 }), null);
});

test("judgments are tallied per dimension, and the unjudged are counted apart", () => {
  const [summary] = summariseJudging(
    [judgment("a", "win"), judgment("b", "loss", "win"), judgment("c", "tie"), { ...judgment("d", "win"), outcome: "failed", results: null }],
    [],
  );

  assert.deepEqual(summary?.byDimension.overall, { win: 1, tie: 1, loss: 1 });
  assert.deepEqual(summary?.byDimension.faithfulness, { win: 2, tie: 1, loss: 0 });
  assert.equal(summary?.unjudged, 1);
  assert.ok(Math.abs(summary!.judgeCostDollars - 0.2) < 1e-9);
});

test("agreement compares a pick with the judge's overall call on the same pair only", () => {
  const [summary] = summariseJudging(
    [judgment("a", "win"), judgment("b", "loss")],
    [pick("a", "win"), pick("b", "win"), pick("unjudged", "loss")],
  );

  assert.deepEqual(summary?.picks, { win: 2, tie: 0, loss: 1 });
  assert.deepEqual(summary?.agreement, { agreed: 1, compared: 2 });
});
