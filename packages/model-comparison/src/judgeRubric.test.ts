import test from "node:test";
import assert from "node:assert/strict";
import { JudgeAnswer, judgePrompt, noteForJudging } from "./judgeRubric.js";
import { makeFetchedTranscript } from "./FetchedTranscriptFactory.testHelper.js";
import { makeOverview } from "./OverviewFactory.testHelper.js";

test("the judge sees the note as the reader reads it, without links that would only cost tokens", () => {
  const note = noteForJudging(makeOverview());

  assert.match(note, /Planning meals cut the grocery bill/);
  assert.doesNotMatch(note, /https?:\/\//);
  assert.doesNotMatch(note, /saved 2026/);
});

test("the prompt gives the transcript with timestamps, both notes, and nothing that names a model", () => {
  const { userMessage, systemPrompt } = judgePrompt(makeFetchedTranscript(), makeOverview(), makeOverview({ inOneLine: "Another line." }));

  assert.match(userMessage, /\[0:30\] Segment 1 talks about shopping\./);
  assert.match(userMessage, /=== Note A ===[\s\S]*=== Note B ===[\s\S]*Another line\./);
  assert.doesNotMatch(`${systemPrompt}${userMessage}`, /claude|gpt|gemini|opus|sonnet|haiku/i);
});

test("every dimension and the overall call need a reason and a winner", () => {
  const call = { reason: "Closer to the transcript.", winner: "A" };
  const answer = { faithfulness: call, verdict: call, howToApply: call, chapters: call, readsAloud: call, overall: call };

  assert.equal(JudgeAnswer.safeParse(answer).success, true);
  assert.equal(JudgeAnswer.safeParse({ ...answer, chapters: { winner: "A" } }).success, false);
  assert.equal(JudgeAnswer.safeParse({ ...answer, overall: { reason: "x", winner: "C" } }).success, false);
});
