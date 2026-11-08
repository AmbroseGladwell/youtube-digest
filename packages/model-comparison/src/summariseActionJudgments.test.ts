import test from "node:test";
import assert from "node:assert/strict";
import type { ActionJudgeRecord, JudgedAction } from "./judgeActions.js";
import { isPracticalAndHelpful, summariseActionJudgments } from "./summariseActionJudgments.js";

const action = (overrides: Partial<JudgedAction> = {}): JudgedAction => ({
  reader: "parent",
  action: "Batch-cook on Sunday.",
  reason: "Because.",
  concrete: "concrete",
  grounding: "sensible-extension",
  fit: "fits",
  doable: "doable",
  helpful: "helpful",
  ...overrides,
});

const record = (overrides: Partial<ActionJudgeRecord>): ActionJudgeRecord => ({
  videoId: "video-one",
  judge: "gemini:gemini-3.1-pro-preview",
  judgedAt: "2026-11-08T12:00:00.000Z",
  outcome: "judged",
  error: null,
  actions: [],
  empty: [],
  calls: [],
  latencyMs: 1000,
  costDollars: 0.1,
  ...overrides,
});

test("practical and helpful needs every part: concrete, true to the video, right about the reader, doable and worth doing", () => {
  assert.equal(isPracticalAndHelpful(action()), true);
  assert.equal(isPracticalAndHelpful(action({ fit: "no-reader" })), true);
  assert.equal(isPracticalAndHelpful(action({ concrete: "principle" })), false);
  assert.equal(isPracticalAndHelpful(action({ grounding: "contradicts-video" })), false);
  assert.equal(isPracticalAndHelpful(action({ fit: "misreads" })), false);
  assert.equal(isPracticalAndHelpful(action({ doable: "not-doable" })), false);
  assert.equal(isPracticalAndHelpful(action({ helpful: "marginal" })), false);
});

test("labels are counted per reader, and a failed judgment counts for nothing", () => {
  const [parent] = summariseActionJudgments(
    ["parent"],
    [
      record({ actions: [action(), action({ fit: "misreads", helpful: "unhelpful" })] }),
      record({ videoId: "video-two", actions: [], empty: [{ reader: "parent", verdict: "missed", reason: "-" }] }),
      record({ videoId: "video-three", outcome: "failed", actions: [action()] }),
    ],
  );

  assert.deepEqual(
    { ...parent, videos: parent!.videos },
    {
      reader: "parent",
      videos: 2,
      actions: 2,
      concrete: 2,
      sensibleExtension: 2,
      contradicts: 0,
      fits: 1,
      generic: 0,
      misreads: 1,
      doable: 2,
      helpful: 1,
      marginal: 0,
      unhelpful: 1,
      practicalAndHelpful: 1,
      emptyRight: 0,
      emptyMissed: 1,
    },
  );
});
