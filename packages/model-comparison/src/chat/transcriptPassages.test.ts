import test from "node:test";
import assert from "node:assert/strict";
import { closestPassages } from "./closestPassages.js";
import { locateQuote } from "./locateQuote.js";
import { scoreReply } from "./scoreReply.js";
import { clockOf, transcriptPassages } from "./transcriptPassages.js";

const segments = [
  { text: "Creatine is a backup", startMs: 0, endMs: 4_000 },
  { text: "store of energy.", startMs: 4_000, endMs: 8_000 },
  { text: "Take three to five grams", startMs: 61_000, endMs: 65_000 },
  { text: "a day, with training.", startMs: 65_000, endMs: 70_000 },
  { text: "  ", startMs: 125_000, endMs: 126_000 },
];

test("passages close once a window's time has passed since their first segment", () => {
  const passages = transcriptPassages(segments, 60_000);
  assert.deepEqual(
    passages.map(({ id, startMs, endMs, text }) => ({ id, startMs, endMs, text })),
    [
      { id: "p1", startMs: 0, endMs: 8_000, text: "Creatine is a backup store of energy." },
      { id: "p2", startMs: 61_000, endMs: 70_000, text: "Take three to five grams a day, with training." },
      { id: "p3", startMs: 125_000, endMs: 126_000, text: "" },
    ],
  );
});

test("a quote is found across segment breaks and punctuation, at the segment it starts in", () => {
  assert.equal(locateQuote(segments, "backup store of energy"), 0);
  assert.equal(locateQuote(segments, "five grams, a day"), 61_000);
  assert.equal(locateQuote(segments, "never said"), null);
});

test("closest passages come back in the order they were said", () => {
  const passages = transcriptPassages(segments, 60_000);
  const picked = closestPassages(
    passages,
    [
      [1, 0],
      [0.9, 0.1],
      [0, 1],
    ],
    [1, 0],
    2,
  );
  assert.deepEqual(
    picked.map((passage) => passage.id),
    ["p1", "p2"],
  );
});

test("a reply scores on whether it cited the moment and answered or declined rightly", () => {
  const passages = transcriptPassages(segments, 60_000);
  const question = { id: "q1", kind: "transcriptOnly" as const, question: "How much?", quotes: ["five grams"], mentions: ["grams"] };
  assert.deepEqual(scoreReply(question, [61_000], { answer: "Three to five grams.", passages: ["p2"], inSource: true }, passages), {
    rightOnSource: true,
    citedRightMoment: true,
    mentioned: true,
    citedUnknownPassage: false,
  });
  assert.deepEqual(scoreReply(question, [61_000], { answer: "Some.", passages: ["p1", "p9"], inSource: true }, passages), {
    rightOnSource: true,
    citedRightMoment: false,
    mentioned: false,
    citedUnknownPassage: true,
  });
  const unanswerable = { id: "q2", kind: "notInSource" as const, question: "Is it vegan?", quotes: [], mentions: [] };
  assert.equal(scoreReply(unanswerable, [], { answer: "Yes.", passages: [], inSource: true }, passages).rightOnSource, false);
  assert.equal(scoreReply(unanswerable, [], { answer: "Not covered.", passages: [], inSource: false }, passages).citedRightMoment, null);
});

test("clock times drop the hour under an hour", () => {
  assert.equal(clockOf(61_000), "1:01");
  assert.equal(clockOf(3_723_000), "1:02:03");
});
