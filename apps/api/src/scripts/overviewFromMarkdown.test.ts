import test from "node:test";
import assert from "node:assert/strict";
import { overviewMarkdown, type Overview, type WebSource } from "@overview/domain";
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
      similarTo: [
        { overviewId: "05738801-9747-465b-a2ef-327e5b127533", title: "Context is now the product | Karri Saarinen" },
        { overviewId: "9f81d73a-3c99-4d46-bbe6-1aedaea45e79", title: "Roles aren't converging (Atlassian CPO)" },
      ],
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

const page = (title: string): WebSource => ({
  kind: "web",
  id: "0123456789abcdef0123456789abcdef" as WebSource["id"],
  url: "https://pages.example/a",
  title,
  siteName: "Pages",
  author: null,
  publishedAt: null,
  language: "en",
  imageUrl: null,
  wordCount: 2300,
});

const rewritten = (overview: Overview) => {
  const markdown = overviewMarkdown(overview, { partIds: true });
  const again = overviewMarkdown({ ...overview, ...overviewFromMarkdown(overviewMarkdown(overview)) } as Overview, { partIds: true });
  return { markdown, again };
};

test("an article reads back to the same Markdown, chapters and Read it anyway? included", () => {
  const { markdown, again } = rewritten(
    storedOverview({
      source: page("Bridge repairs"),
      chapters: null,
      howToApply: { items: ["Ask the council"] },
      article: {
        chapters: [
          { title: "The closure", summary: "Why it shut.", place: { anchor: null, quote: "The bridge, closed" }, wordCount: 1150 },
          { title: "Who pays", summary: "How it splits.", place: { anchor: "who-pays", quote: "The county" }, wordCount: 1150 },
        ],
        keyPointChapters: [0, 1, null],
        readAnyway: { answer: "partial", reason: "The costs chapter is worth it.", leftOut: "", chapterIndexes: [] },
      },
    } as Partial<Overview>),
  );
  assert.equal(again, markdown);
});

test("a recipe page reads back to the same Markdown, figures and method groups included", () => {
  const { markdown, again } = rewritten(
    storedOverview({
      source: page("Leek stew"),
      keyPoints: [],
      coreClaim: "",
      recipe: {
        summary: "A weeknight stew.",
        ingredients: ["3 large leeks", "2 tins cannellini beans"],
        steps: [
          { text: "Roast the leeks for 20 minutes.", group: null },
          { text: "Simmer the beans.", group: "For the beans:" },
        ],
        stepCount: 2,
        prepMinutes: 15,
        cookMinutes: 70,
        totalMinutes: null,
        yield: "Serves 4",
      },
    } as Partial<Overview>),
  );
  assert.equal(again, markdown);
});
