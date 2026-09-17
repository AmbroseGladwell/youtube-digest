import type { TranscriptSegment } from "@overview/types";
import { describe, expect, it } from "vitest";
import { makeTranscriptSegment } from "../types/TranscriptSegmentFactory.testHelper.js";
import { transcriptBlocks } from "./transcriptBlocks.js";

const captionRun = (
  texts: string[],
  { startMs = 0, cueMs = 3000 }: { startMs?: number; cueMs?: number } = {},
): TranscriptSegment[] =>
  texts.map((text, index) =>
    makeTranscriptSegment({
      text,
      startMs: startMs + index * cueMs,
      endMs: startMs + (index + 1) * cueMs,
    }),
  );

const ONE_SENTENCE_IN_FOUR_CUES = [
  "The claim starts here,",
  "and the whole of it takes four captions",
  "before it finally reaches",
  "its first full stop.",
];

const UNPUNCTUATED_CUE = "and then the next thing that happens is this one";

describe("transcriptBlocks", () => {
  it("returns nothing for a transcript with no captions", () => {
    expect(transcriptBlocks([])).toEqual([]);
  });

  it("merges the captions of one sentence into a single block", () => {
    const blocks = transcriptBlocks(captionRun(ONE_SENTENCE_IN_FOUR_CUES, { cueMs: 3500 }));

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.text).toBe(
      "The claim starts here, and the whole of it takes four captions before it finally reaches its first full stop.",
    );
  });

  it("keeps the start time of the caption the block's first words came from", () => {
    const blocks = transcriptBlocks(
      captionRun(ONE_SENTENCE_IN_FOUR_CUES, { startMs: 65_000, cueMs: 3500 }),
    );

    expect(blocks[0]?.startMs).toBe(65_000);
  });

  it("ends a block at the caption that fed it last", () => {
    const blocks = transcriptBlocks(captionRun(ONE_SENTENCE_IN_FOUR_CUES, { cueMs: 3500 }));

    expect(blocks[0]?.endMs).toBe(14_000);
  });

  it("runs a short sentence on into the next rather than leaving it on its own", () => {
    const blocks = transcriptBlocks(captionRun(["And this is where it ends.", "Thanks for watching."]));

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.text).toBe("And this is where it ends. Thanks for watching.");
  });

  it("breaks at a sentence end once the block is comfortably sized", () => {
    const longSentence =
      "This first sentence carries on for long enough on its own to pass the point where a block " +
      "is considered a comfortable size, which takes rather more words than you would think it might.";
    const blocks = transcriptBlocks(captionRun([longSentence, "And this is the second thought."]));

    expect(longSentence.length).toBeGreaterThanOrEqual(180);
    expect(blocks).toHaveLength(2);
  });

  it("breaks at a short sentence anyway once the block has been open eight seconds", () => {
    const texts = ["Short one.", "Another short.", "A third short one."];

    expect(transcriptBlocks(captionRun(texts, { cueMs: 3000 }))).toHaveLength(1);
    expect(transcriptBlocks(captionRun(texts, { cueMs: 9000 }))).toHaveLength(2);
  });

  it("does not break at a comma before the block reaches its ideal length", () => {
    const clause = "The first clause runs on for a good while without reaching a full stop,";

    expect(transcriptBlocks(captionRun([clause, clause]))).toHaveLength(1);
  });

  it("breaks at a comma once the block is past its ideal length", () => {
    const clause = "The first clause runs on for a good while without reaching a full stop,";
    const blocks = transcriptBlocks(captionRun([clause, clause, clause, clause]));

    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.text.endsWith(",")).toBe(true);
  });

  it("breaks captions with no punctuation at all once they run past the block limit", () => {
    const blocks = transcriptBlocks(captionRun(Array(10).fill(UNPUNCTUATED_CUE), { cueMs: 3000 }));

    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.text.length).toBeGreaterThanOrEqual(384);
    expect(blocks[0]?.text.length).toBeLessThan(384 + UNPUNCTUATED_CUE.length);
  });

  it("breaks captions with no punctuation at all once they have run for twenty-five seconds", () => {
    const blocks = transcriptBlocks(captionRun(Array(10).fill(UNPUNCTUATED_CUE), { cueMs: 5000 }));

    expect(blocks[1]?.startMs).toBe(25_000);
  });

  it("does not glue a caption an hour later onto the block before it", () => {
    const blocks = transcriptBlocks([
      makeTranscriptSegment({ text: "the opening words", startMs: 0, endMs: 3000 }),
      makeTranscriptSegment({ text: "and the closing ones", startMs: 3_661_000, endMs: 3_664_000 }),
    ]);

    expect(blocks).toHaveLength(2);
    expect(blocks[1]?.startMs).toBe(3_661_000);
  });

  it("collapses caption whitespace and the space before its punctuation", () => {
    const blocks = transcriptBlocks(captionRun(["  So   this is   spaced out ,  badly ."]));

    expect(blocks[0]?.text).toBe("So this is spaced out, badly.");
  });

  it("strips the speaker markers YouTube puts in its captions", () => {
    const blocks = transcriptBlocks(captionRun([">> And then she said"]));

    expect(blocks[0]?.text).toBe("And then she said");
  });

  it("starts a new block when a new speaker starts talking", () => {
    const blocks = transcriptBlocks(captionRun(["I think that is right.", ">> But I disagree with that."]));

    expect(blocks).toHaveLength(2);
    expect(blocks[1]?.text).toBe("But I disagree with that.");
  });

  it("records which blocks a new speaker opened, since the marker itself is stripped", () => {
    const blocks = transcriptBlocks(captionRun(["I think that is right.", ">> But I disagree with that."]));

    expect(blocks.map((block) => block.speakerChange)).toEqual([false, true]);
  });

  it("gives each turn of an interview its own block, however short the turn is", () => {
    const interview = [
      { text: ">> [music] Today we're speaking with Professor Tracy K. Smith,", startMs: 0, endMs: 5000 },
      { text: "Pulitzer Prizewinning poet, former US poet laurate, and", startMs: 5000, endMs: 8000 },
      { text: "professor of English at Harvard University.", startMs: 8000, endMs: 11_000 },
      { text: ">> Thank you so much for being here, Professor Smith.", startMs: 11_000, endMs: 14_000 },
      { text: ">> Thank you.", startMs: 14_000, endMs: 15_000 },
      { text: ">> I came into your class after hearing you speak at the", startMs: 15_000, endMs: 18_000 },
      { text: "Harvard bookstore about your latest book, Fearless.", startMs: 18_000, endMs: 21_000 },
    ].map((cue) => makeTranscriptSegment(cue));

    expect(transcriptBlocks(interview).map((block) => block.text)).toEqual([
      "[music] Today we're speaking with Professor Tracy K. Smith, Pulitzer Prizewinning poet, former US poet laurate, and professor of English at Harvard University.",
      "Thank you so much for being here, Professor Smith.",
      "Thank you.",
      "I came into your class after hearing you speak at the Harvard bookstore about your latest book, Fearless.",
    ]);
  });

  it("would otherwise run two speakers' words together in one block", () => {
    const unmarked = [
      { text: "Thank you so much for being here, Professor Smith.", startMs: 11_000, endMs: 14_000 },
      { text: "Thank you.", startMs: 14_000, endMs: 15_000 },
      { text: "I came into your class after hearing you speak.", startMs: 15_000, endMs: 18_000 },
    ].map((cue) => makeTranscriptSegment(cue));

    expect(transcriptBlocks(unmarked)).toHaveLength(1);
  });

  it("splits a caption too long to be one block at a clause rather than mid-word", () => {
    const words = Array.from({ length: 80 }, (_, index) => `word${index}`);
    const withAComma = [...words.slice(0, 40), "clause,", ...words.slice(40)].join(" ");
    const blocks = transcriptBlocks(captionRun([withAComma]));

    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.text.endsWith(",")).toBe(true);
  });

  it("skips captions that are empty or only whitespace", () => {
    const blocks = transcriptBlocks([
      makeTranscriptSegment({ text: "   ", startMs: 0, endMs: 3000 }),
      makeTranscriptSegment({ text: "Real words here.", startMs: 3000, endMs: 6000 }),
    ]);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.startMs).toBe(3000);
  });

  it("treats a full-width full stop as the end of a sentence", () => {
    const sentence = `${"这是一个很长的句子".repeat(20)}。`;
    const next = "接下来是第二句话。";

    expect(transcriptBlocks(captionRun([sentence, next]))).toHaveLength(2);
    expect(transcriptBlocks(captionRun([sentence.slice(0, -1), next]))).toHaveLength(1);
  });

  it("keeps every caption's words, in order", () => {
    const texts = [
      ...ONE_SENTENCE_IN_FOUR_CUES,
      "Then a second thought begins, and it carries on",
      "for a while before it too comes to a stop.",
      UNPUNCTUATED_CUE,
    ];
    const blocks = transcriptBlocks(captionRun(texts, { cueMs: 3500 }));

    expect(blocks.map((block) => block.text).join(" ")).toBe(texts.join(" "));
  });
});
