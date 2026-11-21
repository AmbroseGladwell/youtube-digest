import test from "node:test";
import assert from "node:assert/strict";
import { overviewPartHash, type ChatSource, type OverviewId, type OverviewPartItem } from "@overview/domain";
import { makeOverview } from "@overview/store-conformance";
import type { CitedIds } from "./ChatReply.js";
import { citationsOf } from "./citationsOf.js";

const passages = [
  { id: "p1", startMs: 0, endMs: 8_000, text: "one" },
  { id: "p2", startMs: 61_000, endMs: 70_000, text: "two" },
];
const parts: OverviewPartItem[] = [
  { part: "verdict", index: 0, text: "Covers the basics." },
  { part: "dubiousClaim", index: 0, text: "Creatine causes hair loss" },
  { part: "step", index: 0, text: "Take 3 g a day" },
  { part: "step", index: 1, text: "Skip loading" },
];
const labels = new Map([["c1.m2", { chatId: "o:c", message: 1 }]]);
const reply = (fields: Partial<CitedIds>): CitedIds => ({
  passages: [],
  overviewParts: [],
  chatMessages: [],
  inSource: true,
  ...fields,
});

test("ids become times, places in the overview and message places in code, and ids the model wasn't given are dropped", () => {
  assert.deepEqual(
    citationsOf(
      reply({
        passages: ["p2", "p9", "p1", "p2"],
        overviewParts: ["step2", "step7", "dubious1", "step2"],
        chatMessages: ["c1.m2", "c4.m1"],
      }),
      passages,
      parts,
      labels,
    ),
    {
      citations: [
        { startMs: 0, endMs: 8_000 },
        { startMs: 61_000, endMs: 70_000 },
        { part: "dubiousClaim", index: 0, textHash: overviewPartHash("Creatine causes hair loss") },
        { part: "step", index: 1, textHash: overviewPartHash("Skip loading") },
        { chatId: "o:c", message: 1 },
      ],
      inSource: true,
      sourceCitations: 2,
      overviewCitations: 2,
      chatCitations: 1,
      otherOverviewCitations: 0,
      minuteCitations: 0,
    },
  );
});

test("an answer resting only on another chat, or on no passage it was given, isn't in the source", () => {
  assert.equal(citationsOf(reply({ chatMessages: ["c1.m2"] }), passages, parts, labels).inSource, false);
  assert.equal(citationsOf(reply({ passages: ["p9"] }), passages, parts, labels).inSource, false);
  assert.deepEqual(citationsOf(reply({ passages: ["p1"], inSource: false }), passages, parts, labels).citations, []);
});

test("an answer from the overview alone keeps its overview citations and isn't in the source", () => {
  const cited = citationsOf(reply({ overviewParts: ["verdict"], inSource: false }), passages, parts, labels);
  assert.equal(cited.inSource, false);
  assert.deepEqual(cited.citations, [{ part: "verdict", index: 0, textHash: overviewPartHash("Covers the basics.") }]);
});

const other = makeOverview({
  keyPoints: [
    { text: "Beans every day", range: null },
    { text: "Thirty plants a week", range: null },
    { text: "Less sugar", range: null },
  ],
});
const source = (label: string, fields: Partial<ChatSource> = {}): ChatSource => ({
  label,
  overviewId: other.id as OverviewId,
  title: "Eat more plants",
  how: "found",
  ...fields,
});

test("another overview is cited by its label or an item of it, by title from code, and an unknown label or item is dropped", () => {
  const sources = new Map([
    ["S1", { source: source("S1"), overview: other }],
    ["S2", { source: source("S2", { brief: true }), overview: other }],
  ]);
  const cited = citationsOf(
    reply({ overviewParts: ["S1.kp2", "S1", "S1.kp9", "S3", "S3.kp1", "verdict"], inSource: false }),
    passages,
    parts,
    labels,
    sources,
  );
  assert.deepEqual(cited.citations, [
    { part: "verdict", index: 0, textHash: overviewPartHash("Covers the basics.") },
    {
      overviewId: other.id,
      title: "Eat more plants",
      item: { part: "keyPoint", index: 1, textHash: overviewPartHash("Thirty plants a week") },
    },
  ]);
  assert.equal(cited.otherOverviewCitations, 1);
  assert.equal(cited.inSource, false);
});

test("an overview listed in brief is cited as a whole, whatever item the model names", () => {
  const sources = new Map([["S2", { source: source("S2", { brief: true }), overview: other }]]);
  assert.deepEqual(citationsOf(reply({ overviewParts: ["S2.kp1"] }), passages, parts, labels, sources).citations, [
    { overviewId: other.id, title: "Eat more plants", item: null },
  ]);
});
