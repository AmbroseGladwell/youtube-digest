import test from "node:test";
import assert from "node:assert/strict";
import { NOVELTY_BASIS } from "./noveltyLabel.js";
import { makeOverview } from "./OverviewFactory.testHelper.js";
import {
  HOW_TO_APPLY_SECTION,
  KEY_POINTS_SECTION,
  noteSectionNames,
  overviewNoteLines,
} from "./overviewNoteLines.js";
import type { WatchAnyway } from "./WatchAnyway.js";

test("opens with the note's own order: in one line, then the core claim", () => {
  const lines = overviewNoteLines(
    makeOverview({ inOneLine: "A short description.", coreClaim: "The claim." }),
  );

  assert.deepEqual(lines.slice(0, 4), [
    { section: "Summary", heading: true, bullet: false, text: "Premise", spoken: "The premise" },
    { section: "Summary", heading: false, bullet: false, text: "A short description." },
    { section: "Core claim", heading: true, bullet: false, text: "Core claim", spoken: "The core claim" },
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

test("shows the verdict as its label, what it was judged against as a footnote, then the reasoning, and speaks only the reasoning", () => {
  const lines = overviewNoteLines(
    makeOverview({
      verdict: {
        novelty: "common_knowledge",
        standsOut: null,
        dubious: false,
        reasoning: "Standard advice.",
        similarTo: [],
      },
    }),
  );

  assert.deepEqual(lines.filter((line) => line.section === "Verdict"), [
    { section: "Verdict", heading: true, bullet: false, text: "Verdict", spoken: "The verdict" },
    { section: "Verdict", heading: false, bullet: false, text: "Common knowledge.", spoken: "" },
    { section: "Verdict", heading: false, bullet: false, text: NOVELTY_BASIS, spoken: "", footnote: true },
    { section: "Verdict", heading: false, bullet: false, text: "Standard advice." },
  ]);
});

test("names what stands out after the label, speaks it, and carries the stretch of the video it is in", () => {
  const lines = overviewNoteLines(
    makeOverview({
      verdict: {
        novelty: "fresh_angle",
        standsOut: { text: "A worked spreadsheet for the drawdown.", range: { startMs: 60_000, endMs: 90_000 } },
        dubious: false,
        reasoning: "Standard advice otherwise.",
        similarTo: [],
      },
    }),
  );

  assert.deepEqual(
    lines.filter((line) => line.section === "Verdict" && !line.heading).map((line) => line.text),
    ["Fresh angle.", "What stands out: A worked spreadsheet for the drawdown.", NOVELTY_BASIS, "Standard advice otherwise."],
  );
  assert.deepEqual(lines.find((line) => line.text.startsWith("What stands out"))?.range, { startMs: 60_000, endMs: 90_000 });
});

test("gives every key point and every action its own tappable line", () => {
  const lines = overviewNoteLines(
    makeOverview({
      keyPoints: [{ text: "one", range: null }, { text: "two", range: null }, { text: "three", range: null }],
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
      keyPoints: [{ text: "Growth beat expectations.", range: null }, { text: "two", range: null }, { text: "three", range: null }],
      howToApply: { items: ["do this", "and this"] },
    }),
  );

  assert.deepEqual(
    lines.filter((line) => line.bullet).map(({ section, text }) => ({ section, text })),
    [
      { section: KEY_POINTS_SECTION, text: "Growth beat expectations." },
      { section: KEY_POINTS_SECTION, text: "two" },
      { section: KEY_POINTS_SECTION, text: "three" },
      { section: HOW_TO_APPLY_SECTION, text: "do this" },
      { section: HOW_TO_APPLY_SECTION, text: "and this" },
    ],
  );
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

const spokenIn = (lines: ReturnType<typeof overviewNoteLines>, section: string) =>
  lines.filter((line) => line.section === section && !line.heading).map((line) => line.spoken ?? line.text);

test("speaks each heading in its own words while showing the heading unchanged", () => {
  const lines = overviewNoteLines(
    makeOverview({
      verdict: { novelty: "original", standsOut: { text: "A new trial.", range: null }, dubious: false, reasoning: "New.", similarTo: [] },
      howToApply: { items: ["Do it."] },
      selling: { type: "own_paid_product", detail: "A course.", compromisesContent: false },
      watchAnyway: { answer: "no", reason: "Covered.", range: null },
    }),
  );

  assert.deepEqual(
    lines.filter((line) => line.heading).map((line) => [line.text, line.spoken ?? line.text]),
    [
      ["Premise", "The premise"],
      ["Core claim", "The core claim"],
      ["Verdict", "The verdict"],
      ["Key points", "There are three key points"],
      ["How to apply", "How you could apply it"],
      ["What it sells", "What it's selling"],
      ["Watch it anyway?", "Should you watch it anyway?"],
    ],
  );
});

test("speaks 'No clear claim' as it is shown", () => {
  const heading = overviewNoteLines(makeOverview({ thin: true })).find(
    (line) => line.section === "Core claim" && line.heading,
  );

  assert.equal(heading?.spoken ?? heading?.text, "No clear claim");
});

test("counts the key points aloud, then links them the way a person would", () => {
  const lines = overviewNoteLines(
    makeOverview({ keyPoints: [{ text: "Sets beat weight.", range: null }, { text: "Rest matters.", range: null }, { text: "Sleep counts.", range: null }, { text: "Eat protein.", range: null }, { text: "Track it.", range: null }] }),
  );

  assert.equal(lines.find((line) => line.section === KEY_POINTS_SECTION && line.heading)?.spoken, "There are five key points");
  assert.deepEqual(spokenIn(lines, KEY_POINTS_SECTION), [
    "First, sets beat weight.",
    "Then, rest matters.",
    "Also, sleep counts.",
    "On top of that, eat protein.",
    "And finally, track it.",
  ]);
});

test("never repeats a linking word in a list of seven key points", () => {
  const lines = overviewNoteLines(makeOverview({ keyPoints: [{ text: "A.", range: null }, { text: "B.", range: null }, { text: "C.", range: null }, { text: "D.", range: null }, { text: "E.", range: null }, { text: "F.", range: null }, { text: "G.", range: null }] }));
  const links = spokenIn(lines, KEY_POINTS_SECTION).map((spoken) => spoken.split(",")[0]);

  assert.equal(new Set(links).size, 7);
});

test("links actions as steps, and leaves a single action alone", () => {
  const one = overviewNoteLines(makeOverview({ howToApply: { items: ["Do it."] } }));
  const two = overviewNoteLines(makeOverview({ howToApply: { items: ["Do this.", "Do that."] } }));
  const three = overviewNoteLines(makeOverview({ howToApply: { items: ["Do this.", "Do that.", "Rest."] } }));

  assert.deepEqual(spokenIn(one, HOW_TO_APPLY_SECTION), ["Do it."]);
  assert.deepEqual(spokenIn(two, HOW_TO_APPLY_SECTION), ["First, do this.", "And finally, do that."]);
  assert.deepEqual(spokenIn(three, HOW_TO_APPLY_SECTION), ["First, do this.", "Then, do that.", "And finally, rest."]);
});

test("keeps the capital on an acronym or 'I' after the ordering word", () => {
  const lines = overviewNoteLines(makeOverview({ keyPoints: [{ text: "ETFs win.", range: null }, { text: "I said so.", range: null }, { text: "iPhones help.", range: null }] }));

  assert.deepEqual(spokenIn(lines, KEY_POINTS_SECTION), [
    "First, ETFs win.",
    "Then, I said so.",
    "And finally, iPhones help.",
  ]);
});

test("speaks each watch-it-anyway answer before the reason, the partial range in words", () => {
  const spoken = (watchAnyway: WatchAnyway) =>
    spokenIn(overviewNoteLines(makeOverview({ watchAnyway })), "Watch it anyway?");

  assert.deepEqual(spoken({ answer: "yes", reason: "The form is the point.", range: null }), [
    "Yes, it's worth watching. The form is the point.",
  ]);
  assert.deepEqual(spoken({ answer: "no", reason: "Nothing visual.", range: null }), [
    "No, you can probably skip the video, the overview covers it. Nothing visual.",
  ]);
  assert.deepEqual(
    spoken({ answer: "partial", reason: "The demo.", range: { startMs: 750_000, endMs: 1_125_000 } }),
    ["Yes, it's worth watching one part, from 12 minutes 30 to 18 minutes 45. The demo."],
  );
});

test("the watch-anyway line carries the stretch worth watching, and a plain no carries none", () => {
  const watchLine = (watchAnyway: WatchAnyway) =>
    overviewNoteLines(makeOverview({ watchAnyway })).find((line) => line.section === "Watch it anyway?" && !line.heading);

  assert.deepEqual(
    watchLine({ answer: "partial", reason: "One stretch.", range: { startMs: 200_000, endMs: 310_000 } })?.range,
    { startMs: 200_000, endMs: 310_000 },
  );
  assert.equal(watchLine({ answer: "no", reason: "Covered.", range: null })?.range, undefined);
});
