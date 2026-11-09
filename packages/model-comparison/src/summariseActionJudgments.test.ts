import test from "node:test";
import assert from "node:assert/strict";
import type { ActionJudgeRecord, JudgedAction } from "./judgeActions.js";
import { isPracticalAndHelpful, summariseActionJudgments } from "./summariseActionJudgments.js";
import { beforeAndAfterLines } from "./readerSpreadMarkdown.js";

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

test("a reader's earlier actions sit beside this run's, from the same calls, and readers without them are left out", () => {
  const records = [
    record({
      actions: [
        action({ reader: "parent", fit: "fits" }),
        action({ reader: "parent", fit: "generic", helpful: "marginal" }),
        action({ reader: "parent@before", fit: "generic", helpful: "marginal" }),
        action({ reader: "parent@before", fit: "generic", helpful: "marginal" }),
        action({ reader: "founder", fit: "fits" }),
      ],
    }),
  ];

  const lines = beforeAndAfterLines(summariseActionJudgments(["parent", "founder", "parent@before"], records));

  assert.deepEqual(
    lines.filter((line) => line.startsWith("| parent")),
    ["| parent | 0% | 50% | 0% | 50% | 2 of 2 | 1 of 2 |"],
  );
  assert.equal(
    lines.some((line) => line.startsWith("| founder")),
    false,
  );
  assert.deepEqual(beforeAndAfterLines(summariseActionJudgments(["founder"], records)), []);
});
