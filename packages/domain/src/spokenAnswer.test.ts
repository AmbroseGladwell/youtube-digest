import test from "node:test";
import assert from "node:assert/strict";
import type { ChatAnswerSections } from "./Chat.js";
import { CODE_ON_SCREEN, TABLE_ON_SCREEN, spokenAnswer } from "./spokenAnswer.js";

const said = (text: string) => spokenAnswer({ text }).map(({ spoken }) => spoken);

test("reads an answer sentence by sentence, each one a line of its own", () => {
  assert.deepEqual(said("Creatine works for most people. Take it daily.\nTiming matters less."), [
    "Creatine works for most people.",
    "Take it daily.",
    "Timing matters less.",
  ]);
});

test("reads the words of bold, italics, inline code and links, never their marks or addresses", () => {
  assert.deepEqual(said("**Rest** matters, _really_. Run `npm test` first. See [the guide](https://example.com/guide)."), [
    "Rest matters, really.",
    "Run npm test first.",
    "See the guide.",
  ]);
});

test("drops a bare address, and a sentence that was only an address", () => {
  assert.deepEqual(said("Details are at https://example.com/a?b=1. More at www.example.org.\nhttps://example.com"), [
    "Details are at.",
    "More at.",
  ]);
});

test("says a code block is on screen instead of reading it", () => {
  assert.deepEqual(said("Run this:\n```bash\nnpm install\nnpm test\n```\nThen check the output."), [
    "Run this:",
    CODE_ON_SCREEN,
    "Then check the output.",
  ]);
});

test("says a table is on screen once, whatever its rows", () => {
  assert.deepEqual(said("Compare them.\n| Plan | Price |\n|---|---|\n| Free | £0 |\n| Plus | £7.99 |\nPlus costs more."), [
    "Compare them.",
    TABLE_ON_SCREEN,
    "Plus costs more.",
  ]);
});

test("a heading or list line becomes a sentence of its own, ending in a pause, without its marker", () => {
  assert.deepEqual(said("## Why it works\n1. Heat the oil\n- Add salt\n> A quote"), [
    "Why it works.",
    "Heat the oil.",
    "Add salt.",
    "A quote.",
  ]);
});

test("numbers, currencies and decimals are said as words", () => {
  assert.deepEqual(said("It costs £2.50, about 1.5% of $5k."), ["It costs 2 pounds 50, about 1 point 5 percent of 5 thousand dollars."]);
});

test("a citation the model left in as an aside is not read", () => {
  assert.deepEqual(said("She makes that claim (p16–p17)."), ["She makes that claim."]);
});

test("an answer in sections reads intro, each section's heading, paragraphs and lists, then the takeaway", () => {
  const sections: ChatAnswerSections = {
    intro: "Two things matter.",
    introSources: [],
    sections: [
      {
        heading: "Dose",
        paragraphs: ["Take 3 g. Every day."],
        numbered: [{ text: "Mix it in water", sources: [] }],
        bullets: [{ text: "No loading phase.", sources: [] }],
        sources: [],
      },
    ],
    takeaway: "Keep it simple.",
  };
  const spoken = spokenAnswer({ text: "flattened", sections });
  assert.deepEqual(
    spoken.map(({ place, spoken: words }) => [place, words]),
    [
      [{ part: "intro" }, "Two things matter."],
      [{ part: "heading", section: 0 }, "Dose."],
      [{ part: "paragraph", section: 0, paragraph: 0 }, "Take 3 g."],
      [{ part: "paragraph", section: 0, paragraph: 0 }, "Every day."],
      [{ part: "numbered", section: 0, item: 0 }, "Mix it in water."],
      [{ part: "bullet", section: 0, item: 0 }, "No loading phase."],
      [{ part: "takeaway" }, "Keep it simple."],
    ],
  );
});

test("each sentence points at where it is shown, so the app can highlight it", () => {
  const text = "Intro here.\nFirst **bold** one. Second one.";
  const [, first, second] = spokenAnswer({ text });
  const shownBlock = text.split("\n")[1]!;
  assert.deepEqual([first!.block, shownBlock.slice(first!.start, first!.end)], [1, "First **bold** one."]);
  assert.deepEqual([second!.block, shownBlock.slice(second!.start, second!.end)], [1, "Second one."]);
});
