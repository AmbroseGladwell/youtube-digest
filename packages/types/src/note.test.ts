import test from "node:test";
import assert from "node:assert/strict";
import { Note } from "./note.js";

const baseVideo = {
  url: "https://www.youtube.com/watch?v=example",
  title: "Example",
  channel: "Example Channel",
  description: null,
  durationMs: null,
};

const baseNote = {
  id: "example",
  video: baseVideo,
  savedAt: new Date().toISOString(),
  savedNote: null,
  inOneLine: "A short description of the video.",
  coreClaim: "The single assertion this video makes.",
  thin: false,
  keyPoints: ["one", "two", "three"],
  topicIds: [] as string[],
  tags: ["one-tag", "two-tag", "three-tag"],
  verdict: null,
  selling: null,
  howToApply: null,
  watchAnyway: null,
};

test("a note with every optional section toggled off validates", () => {
  assert.doesNotThrow(() => Note.parse(baseNote));
});

test("an empty topicIds array is a valid, unsorted note", () => {
  assert.doesNotThrow(() => Note.parse({ ...baseNote, topicIds: [] }));
});

test("a note can be filed under more than one topic at once", () => {
  assert.doesNotThrow(() => Note.parse({ ...baseNote, topicIds: ["business", "finance"] }));
});

test("a thin note is rejected if it still carries a verdict", () => {
  assert.throws(() =>
    Note.parse({
      ...baseNote,
      thin: true,
      verdict: { novelty: "novel", dubious: false, reasoning: "x", similarTo: [] },
    }),
  );
});

test("dubious is a plain boolean — no overreaching/unverified values are exposed", () => {
  const verdict = (dubious: boolean) => ({
    novelty: "novel" as const,
    dubious,
    reasoning: "x",
    similarTo: [],
  });
  assert.doesNotThrow(() => Note.parse({ ...baseNote, verdict: verdict(false) }));
  assert.doesNotThrow(() => Note.parse({ ...baseNote, verdict: verdict(true) }));
});

test("selling toggled off (null) and selling that ran and found nothing ({type: 'none'}) are different, both valid, states", () => {
  assert.doesNotThrow(() => Note.parse({ ...baseNote, selling: null }));
  assert.doesNotThrow(() =>
    Note.parse({
      ...baseNote,
      selling: { type: "none", detail: "Nothing detected.", compromisesContent: false },
    }),
  );
});

test("how-to-apply's empty items array is the honest 'nothing to apply' case, not an error", () => {
  assert.doesNotThrow(() => Note.parse({ ...baseNote, howToApply: { items: [] } }));
});

test("a partial watch-it-anyway answer requires a range", () => {
  assert.throws(() =>
    Note.parse({ ...baseNote, watchAnyway: { answer: "partial", reason: "x", range: null } }),
  );
  assert.doesNotThrow(() =>
    Note.parse({
      ...baseNote,
      watchAnyway: {
        answer: "partial",
        reason: "x",
        range: { startMs: 1000, endMs: 2000 },
      },
    }),
  );
});

test("a yes/no watch-it-anyway answer doesn't need a range", () => {
  assert.doesNotThrow(() =>
    Note.parse({ ...baseNote, watchAnyway: { answer: "no", reason: "x", range: null } }),
  );
});

test("in one line rejects more than 25 words", () => {
  const tooLong = Array(26).fill("word").join(" ");
  assert.throws(() => Note.parse({ ...baseNote, inOneLine: tooLong }));
});

test("core claim allows up to 60 words but no more", () => {
  const atLimit = Array(60).fill("word").join(" ");
  const overLimit = Array(61).fill("word").join(" ");
  assert.doesNotThrow(() => Note.parse({ ...baseNote, coreClaim: atLimit }));
  assert.throws(() => Note.parse({ ...baseNote, coreClaim: overLimit }));
});

test("key points must be 3 to 5 items, matching the real sample that broke the old free-text limit", () => {
  assert.throws(() => Note.parse({ ...baseNote, keyPoints: ["one", "two"] }));
  assert.throws(() =>
    Note.parse({ ...baseNote, keyPoints: ["1", "2", "3", "4", "5", "6"] }),
  );
});

test("tags must be lowercase and hyphenated", () => {
  assert.throws(() => Note.parse({ ...baseNote, tags: ["Ray-Dalio", "ai", "careers"] }));
});

test("the business/adaptability sample's real content, filed under two topics, validates end to end", () => {
  assert.doesNotThrow(() =>
    Note.parse({
      ...baseNote,
      video: {
        ...baseVideo,
        title: "Ray Dalio: Advice for the Next Generation (AI Era).",
        channel: "The Leader's Inner Compass",
      },
      inOneLine:
        "An interview clip: Ray Dalio on what he'd tell a 16-year-old about careers in the AI era, widening into debt cycles, inequality and the UK.",
      coreClaim:
        "Naming a target job is the wrong advice in a period of rapid change, because what compounds is knowing your own nature, maximising your ability to learn, and staying adaptable enough to move as the paths shift.",
      keyPoints: [
        "His refusal to name a job is the substance, not a dodge.",
        "Adaptability over intelligence or effort.",
        "Match the work to your nature, but do not ignore the money.",
        "On inequality he argues a floor is in society's own interest.",
        "On the UK he is blunt - over-indebted, under-productive, out of choices.",
      ],
      topicIds: ["business", "finance"],
      tags: ["careers", "ai", "adaptability", "ray-dalio", "debt-cycles", "uk-economy"],
      verdict: {
        novelty: "competent_not_new",
        dubious: false,
        reasoning:
          "The career advice is honest, but the macro half is delivered as diagnosis with no counter-case offered.",
        similarTo: [],
      },
      selling: {
        type: "own_free_promotion",
        detail: "His free Principles U personality assessment, named twice.",
        compromisesContent: false,
      },
      howToApply: {
        items: [
          "Take the free Principles U assessment this week to name your own strengths honestly.",
        ],
      },
      watchAnyway: {
        answer: "no",
        reason: "It is two people in chairs; nothing visual carries any part of the argument.",
        range: null,
      },
    }),
  );
});
