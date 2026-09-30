import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { TranscriptSegment } from "./TranscriptSegment.js";
import {
  makeCaptionRun,
  makeTranscriptSegment,
} from "./TranscriptSegmentFactory.testHelper.js";
import { transcriptBlocks } from "./transcriptBlocks.js";

const ONE_SENTENCE_IN_FOUR_CUES = [
  "The claim starts here,",
  "and the whole of it takes four captions",
  "before it finally reaches",
  "its first full stop.",
];

const UNPUNCTUATED_CUE = "and then the next thing that happens is this one";

describe("transcriptBlocks", () => {
  it("returns nothing for a transcript with no captions", () => {
    assert.deepEqual(transcriptBlocks([]), []);
  });

  it("merges the captions of one sentence into a single block", () => {
    const blocks = transcriptBlocks(makeCaptionRun(ONE_SENTENCE_IN_FOUR_CUES, { cueMs: 3500 }));

    assert.equal(blocks.length, 1);
    assert.equal(blocks[0]?.text, "The claim starts here, and the whole of it takes four captions before it finally reaches its first full stop.");
  });

  it("keeps the start time of the caption the block's first words came from", () => {
    const blocks = transcriptBlocks(
      makeCaptionRun(ONE_SENTENCE_IN_FOUR_CUES, { startMs: 65_000, cueMs: 3500 }),
    );

    assert.equal(blocks[0]?.startMs, 65_000);
  });

  it("ends a block at the caption that fed it last", () => {
    const blocks = transcriptBlocks(makeCaptionRun(ONE_SENTENCE_IN_FOUR_CUES, { cueMs: 3500 }));

    assert.equal(blocks[0]?.endMs, 14_000);
  });

  it("runs a short sentence on into the next rather than leaving it on its own", () => {
    const blocks = transcriptBlocks(
      makeCaptionRun(["And this is where it ends.", "Thanks for watching."]),
    );

    assert.equal(blocks.length, 1);
    assert.equal(blocks[0]?.text, "And this is where it ends. Thanks for watching.");
  });

  it("breaks at a sentence end once the block is comfortably sized", () => {
    const longSentence =
      "This first sentence carries on for long enough on its own to pass the point where a block " +
      "is considered a comfortable size, which takes rather more words than you would think it might.";
    const blocks = transcriptBlocks(
      makeCaptionRun([longSentence, "And this is the second thought."]),
    );

    assert.ok(longSentence.length >= 180);
    assert.equal(blocks.length, 2);
  });

  it("breaks at a short sentence anyway once the block has been open eight seconds", () => {
    const texts = ["Short one.", "Another short.", "A third short one."];

    assert.equal(transcriptBlocks(makeCaptionRun(texts, { cueMs: 3000 })).length, 1);
    assert.equal(transcriptBlocks(makeCaptionRun(texts, { cueMs: 9000 })).length, 2);
  });

  it("does not break at a comma before the block reaches its ideal length", () => {
    const clause = "The first clause runs on for a good while without reaching a full stop,";

    assert.equal(transcriptBlocks(makeCaptionRun([clause, clause])).length, 1);
  });

  it("breaks at a comma once the block is past its ideal length", () => {
    const clause = "The first clause runs on for a good while without reaching a full stop,";
    const blocks = transcriptBlocks(makeCaptionRun([clause, clause, clause, clause]));

    assert.equal(blocks.length, 2);
    assert.equal(blocks[0]?.text.endsWith(","), true);
  });

  it("breaks captions with no punctuation at all once they run past the block limit", () => {
    const blocks = transcriptBlocks(
      makeCaptionRun(Array(10).fill(UNPUNCTUATED_CUE), { cueMs: 3000 }),
    );

    assert.equal(blocks.length, 2);
    const length = blocks[0]?.text.length ?? 0;
    assert.ok(length >= 384);
    assert.ok(length < 384 + UNPUNCTUATED_CUE.length);
  });

  it("breaks captions with no punctuation at all once they have run for twenty-five seconds", () => {
    const blocks = transcriptBlocks(
      makeCaptionRun(Array(10).fill(UNPUNCTUATED_CUE), { cueMs: 5000 }),
    );

    assert.equal(blocks[1]?.startMs, 25_000);
  });

  it("does not glue a caption an hour later onto the block before it", () => {
    const blocks = transcriptBlocks([
      makeTranscriptSegment({ text: "the opening words", startMs: 0, endMs: 3000 }),
      makeTranscriptSegment({ text: "and the closing ones", startMs: 3_661_000, endMs: 3_664_000 }),
    ]);

    assert.equal(blocks.length, 2);
    assert.equal(blocks[1]?.startMs, 3_661_000);
  });

  it("collapses caption whitespace and the space before its punctuation", () => {
    const blocks = transcriptBlocks(makeCaptionRun(["  So   this is   spaced out ,  badly ."]));

    assert.equal(blocks[0]?.text, "So this is spaced out, badly.");
  });

  it("drops the non-speech annotations YouTube writes in square brackets", () => {
    const blocks = transcriptBlocks(
      makeCaptionRun([
        "[Applause] That is the whole idea.",
        "[MUSIC PLAYING] And here is the next one.",
      ]),
    );

    assert.equal(blocks[0]?.text, "That is the whole idea. And here is the next one.");
  });

  it("keeps a bracketed speaker name, which is an annotation of who is talking, not of noise", () => {
    const blocks = transcriptBlocks(makeCaptionRun(["[Alice] I think that is right."]));

    assert.equal(blocks[0]?.text, "[Alice] I think that is right.");
  });

  it("skips a caption that is nothing but an annotation", () => {
    const blocks = transcriptBlocks([
      makeTranscriptSegment({ text: "[Music]", startMs: 0, endMs: 3000 }),
      makeTranscriptSegment({ text: "Real words here.", startMs: 3000, endMs: 6000 }),
    ]);

    assert.equal(blocks.length, 1);
    assert.equal(blocks[0]?.startMs, 3000);
  });

  it("strips the speaker markers YouTube puts in its captions", () => {
    const blocks = transcriptBlocks(makeCaptionRun([">> And then she said"]));

    assert.equal(blocks[0]?.text, "And then she said");
  });

  it("starts a new block when a new speaker starts talking", () => {
    const blocks = transcriptBlocks(
      makeCaptionRun(["I think that is right.", ">> But I disagree with that."]),
    );

    assert.equal(blocks.length, 2);
    assert.equal(blocks[1]?.text, "But I disagree with that.");
  });

  it("records which blocks a new speaker opened, since the marker itself is stripped", () => {
    const blocks = transcriptBlocks(
      makeCaptionRun(["I think that is right.", ">> But I disagree with that."]),
    );

    assert.deepEqual(blocks.map((block) => block.speakerChange), [false, true]);
  });

  it("gives each turn of an interview its own block, however short the turn is", () => {
    const interview = [
      {
        text: ">> [music] Today we're speaking with Professor Tracy K. Smith,",
        startMs: 0,
        endMs: 5000,
      },
      {
        text: "Pulitzer Prizewinning poet, former US poet laurate, and",
        startMs: 5000,
        endMs: 8000,
      },
      { text: "professor of English at Harvard University.", startMs: 8000, endMs: 11_000 },
      {
        text: ">> Thank you so much for being here, Professor Smith.",
        startMs: 11_000,
        endMs: 14_000,
      },
      { text: ">> Thank you.", startMs: 14_000, endMs: 15_000 },
      {
        text: ">> I came into your class after hearing you speak at the",
        startMs: 15_000,
        endMs: 18_000,
      },
      {
        text: "Harvard bookstore about your latest book, Fearless.",
        startMs: 18_000,
        endMs: 21_000,
      },
    ].map((cue) => makeTranscriptSegment(cue));

    assert.deepEqual(transcriptBlocks(interview).map((block) => block.text), [
      "Today we're speaking with Professor Tracy K. Smith, Pulitzer Prizewinning poet, former US poet laurate, and professor of English at Harvard University.",
      "Thank you so much for being here, Professor Smith.",
      "Thank you.",
      "I came into your class after hearing you speak at the Harvard bookstore about your latest book, Fearless.",
    ]);
  });

  it("would otherwise run two speakers' words together in one block", () => {
    const unmarked = [
      {
        text: "Thank you so much for being here, Professor Smith.",
        startMs: 11_000,
        endMs: 14_000,
      },
      { text: "Thank you.", startMs: 14_000, endMs: 15_000 },
      { text: "I came into your class after hearing you speak.", startMs: 15_000, endMs: 18_000 },
    ].map((cue) => makeTranscriptSegment(cue));

    assert.equal(transcriptBlocks(unmarked).length, 1);
  });

  it("splits a caption too long to be one block at a clause rather than mid-word", () => {
    const words = Array.from({ length: 80 }, (_, index) => `word${index}`);
    const withAComma = [...words.slice(0, 40), "clause,", ...words.slice(40)].join(" ");
    const blocks = transcriptBlocks(makeCaptionRun([withAComma]));

    assert.equal(blocks.length, 2);
    assert.equal(blocks[0]?.text.endsWith(","), true);
  });

  it("skips captions that are empty or only whitespace", () => {
    const blocks = transcriptBlocks([
      makeTranscriptSegment({ text: "   ", startMs: 0, endMs: 3000 }),
      makeTranscriptSegment({ text: "Real words here.", startMs: 3000, endMs: 6000 }),
    ]);

    assert.equal(blocks.length, 1);
    assert.equal(blocks[0]?.startMs, 3000);
  });

  it("treats a full-width full stop as the end of a sentence", () => {
    const sentence = `${"这是一个很长的句子".repeat(20)}。`;
    const next = "接下来是第二句话。";

    assert.equal(transcriptBlocks(makeCaptionRun([sentence, next])).length, 2);
    assert.equal(transcriptBlocks(makeCaptionRun([sentence.slice(0, -1), next])).length, 1);
  });

  it("keeps every caption's words, in order", () => {
    const texts = [
      ...ONE_SENTENCE_IN_FOUR_CUES,
      "Then a second thought begins, and it carries on",
      "for a while before it too comes to a stop.",
      UNPUNCTUATED_CUE,
    ];
    const blocks = transcriptBlocks(makeCaptionRun(texts, { cueMs: 3500 }));

    assert.equal(blocks.map((block) => block.text).join(" "), texts.join(" "));
  });
});
