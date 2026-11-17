import test from "node:test";
import assert from "node:assert/strict";
import { citationsOf } from "./citationsOf.js";

const passages = [
  { id: "p1", startMs: 0, endMs: 8_000, text: "one" },
  { id: "p2", startMs: 61_000, endMs: 70_000, text: "two" },
];
const labels = new Map([["c1.m2", { chatId: "o:c", message: 1 }]]);

test("ids become times and message places in code, and ids the model wasn't given are dropped", () => {
  assert.deepEqual(
    citationsOf({ answer: "a", passages: ["p2", "p9", "p1", "p2"], chatMessages: ["c1.m2", "c4.m1"], inSource: true }, passages, labels),
    {
      citations: [
        { startMs: 0, endMs: 8_000 },
        { startMs: 61_000, endMs: 70_000 },
        { chatId: "o:c", message: 1 },
      ],
      inSource: true,
      sourceCitations: 2,
      chatCitations: 1,
    },
  );
});

test("an answer resting only on another chat, or on no passage it was given, isn't in the source", () => {
  assert.equal(citationsOf({ answer: "a", passages: [], chatMessages: ["c1.m2"], inSource: true }, passages, labels).inSource, false);
  assert.equal(citationsOf({ answer: "a", passages: ["p9"], chatMessages: [], inSource: true }, passages, labels).inSource, false);
  assert.deepEqual(citationsOf({ answer: "a", passages: ["p1"], chatMessages: [], inSource: false }, passages, labels).citations, []);
});
