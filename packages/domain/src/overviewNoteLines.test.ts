import test from "node:test";
import assert from "node:assert/strict";
import { makeOverview } from "./OverviewFactory.testHelper.js";
import {
  HOW_TO_APPLY_SECTION,
  KEY_POINTS_SECTION,
  noteSectionNames,
  overviewNoteLines,
} from "./overviewNoteLines.js";

test("opens with the note's own order: in one line, then the core claim", () => {
  const lines = overviewNoteLines(
    makeOverview({ inOneLine: "A short description.", coreClaim: "The claim." }),
  );

  assert.deepEqual(lines.slice(0, 4), [
    { section: "Summary", heading: true, bullet: false, text: "Premise" },
    { section: "Summary", heading: false, bullet: false, text: "A short description." },
    { section: "Core claim", heading: true, bullet: false, text: "Core claim" },
    { section: "Core claim", heading: false, bullet: false, text: "The claim." },
  ]);
});

test("titles the claim section 'No clear claim' when the overview is thin", () => {
  const lines = overviewNoteLines(makeOverview({ thin: true, verdict: null }));

  assert.ok(
    lines.some(
      (line) => line.section === "Core claim" && line.heading && line.text === "No clear claim",
    ),
  );
  assert.ok(!noteSectionNames(lines).includes("Verdict"));
});

test("reads the verdict as its label followed by the reasoning", () => {
  const lines = overviewNoteLines(
    makeOverview({
      verdict: {
        novelty: "recycled",
        dubious: false,
        reasoning: "Standard advice.",
        similarTo: [],
      },
    }),
  );

  assert.deepEqual(lines.filter((line) => line.section === "Verdict"), [
    { section: "Verdict", heading: true, bullet: false, text: "Verdict" },
    { section: "Verdict", heading: false, bullet: false, text: "Recycled." },
    { section: "Verdict", heading: false, bullet: false, text: "Standard advice." },
  ]);
});

test("gives every key point and every action its own tappable line", () => {
  const lines = overviewNoteLines(
    makeOverview({
      keyPoints: ["one", "two", "three"],
      howToApply: { items: ["do this", "then this"] },
    }),
  );

  assert.equal(lines.filter((line) => line.section === KEY_POINTS_SECTION && !line.heading).length, 3);
  assert.equal(lines.filter((line) => line.section === "How to apply" && !line.heading).length, 2);
});

// The note's two list-shaped sections, and only those: the prose sections stay prose.
test("bullets the key points and the actions, leaving the mark out of the text", () => {
  const lines = overviewNoteLines(
    makeOverview({
      keyPoints: ["Growth beat expectations.", "two", "three"],
      howToApply: { items: ["do this", "and this"] },
    }),
  );

  assert.deepEqual(lines.filter((line) => line.bullet), [
    {
      section: KEY_POINTS_SECTION,
      heading: false,
      bullet: true,
      text: "Growth beat expectations.",
    },
    { section: KEY_POINTS_SECTION, heading: false, bullet: true, text: "two" },
    { section: KEY_POINTS_SECTION, heading: false, bullet: true, text: "three" },
    { section: HOW_TO_APPLY_SECTION, heading: false, bullet: true, text: "do this" },
    { section: HOW_TO_APPLY_SECTION, heading: false, bullet: true, text: "and this" },
  ]);
});

test("leaves a heading unbulleted, even the one over a bulleted list", () => {
  const lines = overviewNoteLines(makeOverview({ howToApply: { items: ["do this"] } }));

  assert.ok(lines.filter((line) => line.heading).every((line) => !line.bullet));
});

test("leaves out the sections the overview has no content for", () => {
  const sections = noteSectionNames(
    overviewNoteLines(
      makeOverview({
        howToApply: { items: [] },
        selling: { type: "none", detail: "", compromisesContent: false },
        watchAnyway: null,
        chapters: null,
        verdict: null,
      }),
    ),
  );

  assert.deepEqual(sections, ["Summary", "Core claim", "Key points"]);
});

test("carries the selling and watch-anyway answers as prose once they exist", () => {
  const lines = overviewNoteLines(
    makeOverview({
      selling: { type: "own_paid_product", detail: "A £99 course.", compromisesContent: true },
      watchAnyway: { answer: "no", reason: "The note carries it.", range: null },
    }),
  );

  const texts = lines.map((line) => `${line.section}: ${line.text}`);
  assert.ok(texts.includes("What it sells: Sells their own paid product. A £99 course."));
  assert.ok(
    texts.includes("Watch it anyway?: Skip the video, the overview covers it. The note carries it."),
  );
});

// The jump control is rendered after the whole note, which only puts it under the
// watch-it-anyway paragraph for as long as that is the last section built
// (docs/features/following-playback.md).
test("builds watch it anyway last, which is what the jump control sits under", () => {
  const lines = overviewNoteLines(
    makeOverview({
      howToApply: { items: ["Do the thing."] },
      watchAnyway: {
        answer: "partial",
        reason: "One stretch earns it.",
        range: { startMs: 0, endMs: 1000 },
      },
    }),
  );

  assert.equal(lines.at(-1)?.section, "Watch it anyway?");
});
