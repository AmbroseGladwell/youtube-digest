import test from "node:test";
import assert from "node:assert/strict";
import { combineOrders } from "./judgeKeyPointsPair.js";
import type { KeyPointsJudgeRecord } from "./KeyPointsJudgeRecord.js";
import { keyPointsJudgingMarkdown, sameLetterBothOrders } from "./keyPointsJudgingMarkdown.js";
import { KeyPointsAnswer, keyPointsForJudging, keyPointsPrompt } from "./keyPointsRubric.js";
import { makeFetchedTranscript } from "./FetchedTranscriptFactory.testHelper.js";
import { makeOverview } from "./OverviewFactory.testHelper.js";

const answer = (winners: { choice: string; completeness: string; faithfulness: string; overall: string }): KeyPointsAnswer =>
  KeyPointsAnswer.parse(
    Object.fromEntries(Object.entries(winners).map(([dimension, winner]) => [dimension, { reason: "Because.", winner }])),
  );

test("the judge sees the key points with their places, and none of the fields this judge leaves out", () => {
  const shown = keyPointsForJudging(makeOverview());

  assert.match(shown, /^Premise: /);
  assert.match(shown, /Core claim: /);
  assert.match(shown, /1\. \[\d+:\d{2}–\d+:\d{2}\] /);
  assert.doesNotMatch(shown, /The starting budget|Nothing is sold/);
});

test("the rubric holds a caveat about what a claim rests on to the editorial standard, not against choice", () => {
  const { systemPrompt } = keyPointsPrompt(makeFetchedTranscript(), makeOverview(), makeOverview());

  assert.match(systemPrompt, /never present an anecdote as\s+proof/);
  assert.match(systemPrompt, /do not count it against choice/);
});

test("the prompt gives the transcript with timestamps and both sets of key points", () => {
  const { userMessage } = keyPointsPrompt(makeFetchedTranscript(), makeOverview(), makeOverview({ inOneLine: "Another line." }));

  assert.match(userMessage, /\[0:30\] Segment 1 talks about shopping\./);
  assert.match(userMessage, /=== Note A ===[\s\S]*=== Note B ===[\s\S]*Another line\./);
});

test("a side wins only when both orders agree, and a split is a tie", () => {
  const results = combineOrders(
    answer({ choice: "A", completeness: "A", faithfulness: "tie", overall: "A" }),
    answer({ choice: "B", completeness: "A", faithfulness: "tie", overall: "A" }),
  );

  assert.deepEqual(results, { choice: "win", completeness: "tie", faithfulness: "tie", overall: "tie" });
});

test("the report tallies the dimensions and counts the calls that followed position", () => {
  const record = (videoId: string, first: string, second: string): KeyPointsJudgeRecord => {
    const candidateFirst = answer({ choice: first, completeness: first, faithfulness: "tie", overall: first });
    const candidateSecond = answer({ choice: second, completeness: second, faithfulness: "tie", overall: second });
    return {
      videoId,
      baseline: "openai:gpt-6.1-sol",
      candidate: "openai:gpt-6.1-sol",
      judge: "gemini:gemini-3.1-pro-preview",
      judgedAt: "2026-11-08T12:00:00.000Z",
      outcome: "judged",
      error: null,
      candidateFirst,
      candidateSecond,
      results: combineOrders(candidateFirst, candidateSecond),
      calls: [],
      latencyMs: 1000,
      costDollars: 0.1,
    };
  };
  const records = [record("a", "A", "B"), record("b", "A", "A"), record("c", "B", "A")];

  assert.equal(records.filter(sameLetterBothOrders).length, 1);
  const markdown = keyPointsJudgingMarkdown(
    records,
    ["a", "b", "c"].map((videoId) => ({ videoId, title: `Video ${videoId}`, length: "10:00" })),
    "new",
    "old",
    2,
  );
  assert.match(markdown, /\| overall \| 1 \| 1 \| 1 \| 50% \|/);
  assert.match(markdown, /on 1 of 3 pairs the judge chose the same letter in both orders/);
  assert.match(markdown, /\| Video b \| 10:00 \| tie \|/);
});
