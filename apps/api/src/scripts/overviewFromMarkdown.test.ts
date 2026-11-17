import test from "node:test";
import assert from "node:assert/strict";
import { overviewMarkdown, type Overview } from "@overview/domain";
import { storedOverview } from "../testing/storedRecords.testHelper.js";
import { overviewFromMarkdown } from "./overviewFromMarkdown.js";

test("reads back every item the chat prompt gives an id", () => {
  const overview = storedOverview({
    keyPoints: [
      { text: "The dose is 3 to 5g a day.", range: { startMs: 128_000, endMs: 176_000 } },
      { text: "No range here.", range: null },
    ],
    verdict: {
      novelty: "fresh_angle",
      standsOut: null,
      dubious: true,
      dubiousClaims: [
        { claim: "It causes hair loss", basis: "contradictsSettled", reason: "One small study.", startMs: 3_661_000 },
        { claim: "Buy our tub", basis: "conflictOfInterest", reason: "They sell it.", startMs: null },
      ],
      reasoning: "Covers the basics well. Then overreaches.",
      similarTo: [],
    },
    sourceSteps: {
      items: [
        { text: "Take three grams", range: { startMs: 61_000, endMs: 61_000 }, dubiousReason: null },
        { text: "Skip loading", range: null, dubiousReason: "No trial backs it." },
      ],
    },
    howToApply: { items: ["Add it to a shake", "Keep a tub at work"] },
    selling: { type: "sponsor_or_affiliate", detail: "A supplement brand.", compromisesContent: false },
    watchAnyway: { answer: "partial", reason: "The dosing part is worth seeing.", range: null },
    chapters: [
      { title: "Dosing", summary: "How much: to take.", startMs: 0, endMs: 60_000 },
      { title: "Hair", summary: "The scare.", startMs: 60_000, endMs: 120_000 },
    ],
  } as Partial<Overview>);

  const read = overviewFromMarkdown(overviewMarkdown(overview));

  assert.deepEqual(read.keyPoints, overview.keyPoints);
  assert.deepEqual(read.verdict, overview.verdict);
  assert.deepEqual(read.sourceSteps, overview.sourceSteps);
  assert.deepEqual(read.howToApply, overview.howToApply);
  assert.deepEqual(read.selling, overview.selling);
  assert.deepEqual(read.watchAnyway, overview.watchAnyway);
  assert.deepEqual(
    read.chapters?.map(({ title, summary, startMs }) => ({ title, summary, startMs })),
    overview.chapters?.map(({ title, summary, startMs }) => ({ title, summary, startMs })),
  );
});
