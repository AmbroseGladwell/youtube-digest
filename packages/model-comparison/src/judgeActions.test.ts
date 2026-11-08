import test from "node:test";
import assert from "node:assert/strict";
import { actionJudgeFor, actionJudgePrompt, blindOrder, JudgeAnswerError, resolveAnswer, type ActionLabels } from "./judgeActions.js";
import { parseComparedModel } from "./ComparedModel.js";
import { makeFetchedTranscript } from "./FetchedTranscriptFactory.testHelper.js";

const readers = [
  { name: "nobody", readerContext: null, actions: ["Plan a week of meals."] },
  { name: "specific-parent", readerContext: "I'm an A&E nurse.", actions: ["Batch-cook before night shifts.", "Freeze portions."] },
  { name: "retiree", readerContext: "I'm retired.", actions: [] },
];

const labels = (id: string, overrides: Partial<ActionLabels> = {}): ActionLabels => ({
  id,
  reason: "Because.",
  concrete: "concrete",
  grounding: "from-video",
  fit: "fits",
  doable: "doable",
  helpful: "helpful",
  ...overrides,
});

test("the judge never sees a reader's name, only what is known about them", () => {
  const { userMessage } = actionJudgePrompt(makeFetchedTranscript(), readers);

  for (const reader of readers) assert.doesNotMatch(userMessage, new RegExp(reader.name));
  assert.match(userMessage, /Reader 2 ===\nAbout this reader: I'm an A&E nurse\.\nActions:\n2\.1 Batch-cook/);
  assert.match(userMessage, /Nothing is known about this reader\./);
});

test("the readers' order is shuffled per video, and the same on a rerun", () => {
  const names = (videoId: string) => blindOrder(videoId, readers).map((reader) => reader.name);
  assert.deepEqual(names("video-one"), names("video-one"));
  assert.ok(["a", "b", "c", "d", "e", "f"].some((videoId) => names(videoId).join() !== names("video-one").join()));
});

test("each label lands on its own reader and action, and a reader we know nothing about has no fit", () => {
  const resolved = resolveAnswer(readers, {
    actions: [labels("1.1", { fit: "generic" }), labels("2.1"), labels("2.2", { helpful: "marginal" })],
    empty: [{ reader: "Reader 3", reason: "Nothing here for them.", verdict: "right" }],
  });

  assert.deepEqual(
    resolved.actions.map(({ reader, action, fit, helpful }) => ({ reader, action, fit, helpful })),
    [
      { reader: "nobody", action: "Plan a week of meals.", fit: "no-reader", helpful: "helpful" },
      { reader: "specific-parent", action: "Batch-cook before night shifts.", fit: "fits", helpful: "helpful" },
      { reader: "specific-parent", action: "Freeze portions.", fit: "fits", helpful: "marginal" },
    ],
  );
  assert.deepEqual(resolved.empty, [{ reader: "retiree", verdict: "right", reason: "Nothing here for them." }]);
});

test("an answer that skips, repeats or invents an action is a failure, not a partial count", () => {
  const empty = [{ reader: "Reader 3", reason: "-", verdict: "right" as const }];
  assert.throws(() => resolveAnswer(readers, { actions: [labels("1.1"), labels("2.1")], empty }), JudgeAnswerError);
  assert.throws(() => resolveAnswer(readers, { actions: [labels("1.1"), labels("2.1"), labels("2.1")], empty }), JudgeAnswerError);
  assert.throws(
    () => resolveAnswer(readers, { actions: [labels("1.1"), labels("2.1"), labels("2.2"), labels("3.1")], empty }),
    JudgeAnswerError,
  );
  assert.throws(() => resolveAnswer(readers, { actions: [labels("1.1"), labels("2.1"), labels("2.2")], empty: [] }), JudgeAnswerError);
});

test("the judge is never from the writer's provider", () => {
  assert.notEqual(actionJudgeFor(parseComparedModel("openai:gpt-6.1-sol")).provider, "openai");
  assert.notEqual(actionJudgeFor(parseComparedModel("gemini:gemini-3.1-pro-preview")).provider, "gemini");
  const opus = parseComparedModel("anthropic:claude-opus-5-5");
  assert.equal(actionJudgeFor(parseComparedModel("openai:gpt-6.1-sol"), opus), opus);
  assert.throws(() => actionJudgeFor(parseComparedModel("openai:gpt-6.1-sol"), parseComparedModel("openai:gpt-6.1-sol")));
});
