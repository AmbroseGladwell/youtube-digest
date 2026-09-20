import { describe, expect, it } from "vitest";
import { makeTranscriptBlock } from "../types/TranscriptBlockFactory.testHelper.js";
import { transcriptMatches } from "./transcriptMatches.js";

const BLOCKS = [
  makeTranscriptBlock({ text: "Productivity is the claim, and productivity is the trap." }),
  makeTranscriptBlock({ text: "Nothing in this one." }),
  makeTranscriptBlock({ text: "PRODUCTIVITY, shouted." }),
];

describe("transcriptMatches", () => {
  it("finds nothing for an empty query", () => {
    expect(transcriptMatches(BLOCKS, "")).toEqual([]);
  });

  it("finds nothing for a query of only whitespace", () => {
    expect(transcriptMatches(BLOCKS, "   ")).toEqual([]);
  });

  it("numbers every hit across the whole transcript in reading order", () => {
    expect(transcriptMatches(BLOCKS, "productivity")).toEqual([
      { index: 0, blockIndex: 0, start: 0, end: 12 },
      { index: 1, blockIndex: 0, start: 31, end: 43 },
      { index: 2, blockIndex: 2, start: 0, end: 12 },
    ]);
  });

  it("matches regardless of the case either side was written in", () => {
    expect(transcriptMatches(BLOCKS, "PrOdUcTiViTy")).toHaveLength(3);
  });

  it("matches a phrase across the words of one block", () => {
    expect(transcriptMatches(BLOCKS, "is the trap")).toEqual([
      { index: 0, blockIndex: 0, start: 44, end: 55 },
    ]);
  });

  it("reads the query as characters, not as a regular expression", () => {
    const blocks = [makeTranscriptBlock({ text: "The cost is $4.99 (plus tax)." })];

    expect(transcriptMatches(blocks, "$4.99")).toHaveLength(1);
    expect(transcriptMatches(blocks, "4x99")).toHaveLength(0);
  });

  it("does not overlap two hits on a term that repeats inside itself", () => {
    const blocks = [makeTranscriptBlock({ text: "aaaa" })];

    expect(transcriptMatches(blocks, "aa")).toEqual([
      { index: 0, blockIndex: 0, start: 0, end: 2 },
      { index: 1, blockIndex: 0, start: 2, end: 4 },
    ]);
  });
});
