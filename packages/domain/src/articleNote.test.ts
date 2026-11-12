import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { ArticleDetails } from "./ArticleDetails.js";
import { OverviewId } from "./Brands.js";
import { makeOverview } from "./OverviewFactory.testHelper.js";
import { overviewMarkdown } from "./overviewMarkdown.js";
import { overviewNoteCaptions } from "./overviewNoteCaptions.js";
import { overviewNoteLines, READ_ANYWAY_SECTION } from "./overviewNoteLines.js";
import { Overview } from "./Overview.js";
import type { WebSource } from "./Source.js";
import { spokenOpening } from "./spokenOpening.js";
import { shareSnapshot } from "./shareSnapshot.js";
import { overviewTimeSaved } from "./timeSavedSummary.js";

const source: WebSource = {
  kind: "web",
  id: "0123456789abcdef" as WebSource["id"],
  url: "https://news.example.com/bridge",
  title: "Bridge repairs",
  siteName: "Example News",
  author: "Asha Rao",
  publishedAt: "2026-11-01T09:00:00.000Z",
  language: "en",
  imageUrl: null,
  wordCount: 2300,
};

const details = (overrides: Partial<ArticleDetails> = {}): ArticleDetails => ({
  chapters: [
    { title: "The closure", summary: "Why it shut.", place: { anchor: null, quote: "The bridge" }, wordCount: 1150 },
    { title: "Who pays", summary: "How it splits.", place: { anchor: "who-pays", quote: "The county" }, wordCount: 1150 },
  ],
  keyPointChapters: [0, 1, null],
  readAnyway: { answer: "no", reason: "Nothing here needs the page.", leftOut: "It leaves out the interviews.", chapterIndexes: [] },
  ...overrides,
});

const article = (overrides: Partial<ArticleDetails> = {}): Overview =>
  ({ ...makeOverview(), id: OverviewId.parse(randomUUID()), source, article: details(overrides) }) as Overview;

const readAnywayLine = (overview: Overview) =>
  overviewNoteLines(overview).find((line) => line.section === READ_ANYWAY_SECTION && !line.heading)!;

test("an article is a valid stored overview", () => {
  assert.doesNotThrow(() => Overview.parse(article()));
});

test("read it anyway shows the answer, the reason and what is left out, in that order", () => {
  assert.equal(readAnywayLine(article()).text, "No. Nothing here needs the page. It leaves out the interviews.");
});

test("read it anyway is spoken as a sentence", () => {
  assert.match(readAnywayLine(article()).spoken!, /^No, you can probably skip the article, the overview covers it\. Nothing/);
});

test("a partial answer names its chapters aloud", () => {
  const overview = article({
    readAnyway: { answer: "partial", reason: "It has the figures.", leftOut: "It leaves out the rest.", chapterIndexes: [1] },
  });
  assert.equal(readAnywayLine(overview).text.startsWith("Just part of it. It has the figures."), true);
  assert.match(readAnywayLine(overview).spoken!, /^Yes, it's worth reading part of it: Who pays\./);
});

test("a key point carries its chapter, and says once that the link leaves the app", () => {
  const points = overviewNoteLines(article()).filter((line) => line.section === "Key points" && !line.heading);
  assert.deepEqual(
    points.map((line) => line.chapterIndex),
    [0, 1, undefined],
  );
  assert.match(overviewNoteCaptions(article())["Key points"]!, /Chapter links open the article on Example News/);
});

test("one chapter has nowhere to link to, so nothing links", () => {
  const overview = article({ chapters: details().chapters.slice(0, 1), keyPointChapters: [0, 0, 0] });
  assert.ok(overviewNoteLines(overview).every((line) => line.chapterIndex === undefined));
  assert.equal(overviewNoteCaptions(overview)["Key points"], undefined);
});

test("a video's note has no read it anyway section, and its copy stays byte for byte", () => {
  const video = makeOverview();
  assert.ok(!overviewNoteLines(video).some((line) => line.section === READ_ANYWAY_SECTION));
  assert.ok(!("article" in shareSnapshot({ overview: video, transcript: null, narration: null }).note));
});

test("a shared article keeps its chapters", () => {
  const { note } = shareSnapshot({ overview: article(), transcript: null, narration: null });
  assert.equal(note.article?.chapters.length, 2);
});

test("the spoken opening names the site and the author", () => {
  assert.equal(spokenOpening(source), "Bridge repairs, from Example News, by Asha Rao, published in November 2026.");
});

test("time saved counts the article's reading time at 230 words a minute, less the note", () => {
  assert.deepEqual(overviewTimeSaved(article()), { kind: "counted", minutes: 9, lessPartToWatch: false });
});

test("an article the note says to read in full saves nothing", () => {
  const read = { answer: "yes" as const, reason: "It needs reading.", leftOut: "It leaves out the data.", chapterIndexes: [] };
  assert.deepEqual(overviewTimeSaved(article({ readAnyway: read })), { kind: "watchVerdict" });
});

test("a partial answer takes the named chapters' reading time off", () => {
  const read = { answer: "partial" as const, reason: "Part of it.", leftOut: "It leaves out the rest.", chapterIndexes: [1] };
  assert.deepEqual(overviewTimeSaved(article({ readAnyway: read })), { kind: "counted", minutes: 4, lessPartToWatch: true });
});

const resources = [
  { text: "Neurodiversity Design Toolkit", href: "https://toolkit.example/neuro" },
  { text: "Cognitive accessibility guidance", href: "https://w3.example/coga" },
];

test("an article's resources are stored, at most five, and only https", () => {
  assert.doesNotThrow(() => Overview.parse(article({ resources })));
  assert.throws(() => Overview.parse(article({ resources: Array.from({ length: 6 }, () => resources[0]!) })));
  assert.throws(() => Overview.parse(article({ resources: [{ text: "Old guide", href: "http://old.example/guide" }] })));
  assert.throws(() => Overview.parse(article({ resources: [] })));
});

test("an assistant reads the resources as named links, and a note without them has no such section", () => {
  assert.match(
    overviewMarkdown(article({ resources })),
    /## Resources it links to\n\n- \[Neurodiversity Design Toolkit\]\(https:\/\/toolkit\.example\/neuro\)\n- \[Cognitive accessibility guidance\]\(https:\/\/w3\.example\/coga\)/,
  );
  assert.doesNotMatch(overviewMarkdown(article()), /Resources it links to/);
});

test("a shared article keeps its resources, and one without them shares exactly as before", () => {
  assert.deepEqual(
    shareSnapshot({ overview: article({ resources }), transcript: null, narration: null }).note.article?.resources,
    resources,
  );
  assert.ok(!("resources" in shareSnapshot({ overview: article(), transcript: null, narration: null }).note.article!));
});
