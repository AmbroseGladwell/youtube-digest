import test from "node:test";
import assert from "node:assert/strict";
import type { ExtractedArticle } from "@overview/domain";
import type { GeneratedArticleOutput } from "@overview/generation";
import { articleCoverageInput } from "./articleCoverageInput.js";
import { makeFetchedTranscript } from "./FetchedTranscriptFactory.testHelper.js";
import { makeGeneratedOutput } from "./GeneratedOutputFactory.testHelper.js";
import { measureCoverage } from "./measureCoverage.js";
import { videoCoverageInput } from "./videoCoverageInput.js";

const evenUnits = (count: number, words = 10) => Array.from({ length: count }, () => words);

test("points covering a known part of the source score that share", () => {
  const coverage = measureCoverage({
    unitWords: evenUnits(30),
    points: [
      { start: 0, end: 5 },
      { start: 10, end: 14 },
    ],
    chapterStarts: [0],
  });
  assert.equal(coverage.measurable, true);
  assert.equal(coverage.spanShare, 11 / 30);
});

test("the share is of words, not of positions, so a long segment counts for more", () => {
  const coverage = measureCoverage({ unitWords: [90, 5, 5], points: [{ start: 0, end: 0 }], chapterStarts: [0] });
  assert.equal(coverage.spanShare, 0.9);
});

test("overlapping points are not counted twice", () => {
  const coverage = measureCoverage({
    unitWords: evenUnits(10),
    points: [
      { start: 0, end: 4 },
      { start: 2, end: 6 },
    ],
    chapterStarts: [0],
  });
  assert.equal(coverage.spanShare, 0.7);
});

test("a note whose every point has no position is unmeasurable, not zero", () => {
  const coverage = measureCoverage({ unitWords: evenUnits(30), points: [null, null, null], chapterStarts: [0, 10] });
  assert.equal(coverage.measurable, false);
  assert.equal(coverage.spanShare, null);
  assert.equal(coverage.chapterShare, null);
  assert.equal(coverage.unplaced, 3);
});

test("points with no position are counted beside the measure, which uses the rest", () => {
  const coverage = measureCoverage({ unitWords: evenUnits(10), points: [{ start: 0, end: 4 }, null], chapterStarts: [0] });
  assert.equal(coverage.points, 2);
  assert.equal(coverage.unplaced, 1);
  assert.equal(coverage.spanShare, 0.5);
});

test("a range past the end or running backwards is counted as out of range and left out", () => {
  const coverage = measureCoverage({
    unitWords: evenUnits(10),
    points: [
      { start: 0, end: 1 },
      { start: 8, end: 12 },
      { start: 6, end: 4 },
    ],
    chapterStarts: [0],
  });
  assert.equal(coverage.outOfRange, 2);
  assert.equal(coverage.spanShare, 0.2);
});

test("points all in the first third leave the middle and last thirds as the gap", () => {
  const coverage = measureCoverage({
    unitWords: evenUnits(30),
    points: [
      { start: 0, end: 2 },
      { start: 4, end: 6 },
      { start: 7, end: 9 },
    ],
    chapterStarts: [0, 10, 20],
  });
  assert.deepEqual(coverage.pointsByThird, [3, 0, 0]);
  assert.deepEqual(coverage.largestGap, { start: 10, end: 29, share: 20 / 30 });
  assert.equal(coverage.chaptersReached, 1);
  assert.equal(coverage.chapterShare, 1 / 3);
});

test("a point is placed in the third its middle falls in", () => {
  const coverage = measureCoverage({
    unitWords: evenUnits(30),
    points: [
      { start: 8, end: 13 },
      { start: 17, end: 19 },
      { start: 29, end: 29 },
    ],
    chapterStarts: [0],
  });
  assert.deepEqual(coverage.pointsByThird, [0, 2, 1]);
});

test("a chapter counts as reached when any point's range touches it", () => {
  const coverage = measureCoverage({
    unitWords: evenUnits(30),
    points: [{ start: 8, end: 11 }],
    chapterStarts: [0, 10, 20],
  });
  assert.equal(coverage.chaptersReached, 2);
  assert.equal(coverage.chapters, 3);
  assert.equal(coverage.chapterShare, 2 / 3);
});

test("a video note measures on its transcript's segments", () => {
  const fetched = makeFetchedTranscript(30);
  const coverage = measureCoverage(videoCoverageInput(fetched, makeGeneratedOutput()));
  assert.equal(coverage.points, 3);
  assert.equal(coverage.unplaced, 1);
  assert.equal(coverage.chaptersReached, 2);
  assert.equal(coverage.largestGap?.start, 13);
  assert.equal(coverage.largestGap?.end, 29);
});

const article: ExtractedArticle = {
  url: "https://example.com/piece",
  title: "A piece",
  siteName: null,
  author: null,
  publishedAt: null,
  language: "en",
  imageUrl: null,
  sections: [
    { heading: null, anchor: null, text: "One two three four five.\n\nSix seven eight nine ten.", links: [] },
    {
      heading: "Later",
      anchor: "later",
      text: "Eleven twelve thirteen fourteen fifteen.\n\nSixteen seventeen eighteen nineteen twenty.",
      links: [],
    },
  ],
  wordCount: 20,
  recipe: null,
};

const articleOutput = (paragraphs: (number | null)[]): GeneratedArticleOutput => ({
  inOneLine: "",
  sourceSteps: [],
  bigPicture: "",
  coreClaim: "",
  thin: false,
  keyPoints: paragraphs.map((paragraphIndex) => ({ text: "", paragraphIndex })),
  chapters: [
    { title: "", summary: "", startParagraphIndex: 0 },
    { title: "", summary: "", startParagraphIndex: 2 },
  ],
  matchedTopicNames: [],
  tags: [],
});

test("an article note measures the same way on paragraph positions", () => {
  const coverage = measureCoverage(articleCoverageInput(article, articleOutput([0, null, 3])));
  assert.equal(coverage.totalWords, 20);
  assert.equal(coverage.unplaced, 1);
  assert.equal(coverage.spanShare, 0.5);
  assert.equal(coverage.chaptersReached, 2);
  assert.deepEqual(coverage.largestGap, { start: 1, end: 2, share: 0.5 });
});
