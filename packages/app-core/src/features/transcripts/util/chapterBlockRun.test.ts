import { describe, expect, it } from "vitest";
import { makeTranscriptBlock } from "../types/TranscriptBlockFactory.testHelper.js";
import { chapterBlockRun } from "./chapterBlockRun.js";

const BLOCKS = [
  makeTranscriptBlock({ startMs: 0, endMs: 10_000 }),
  makeTranscriptBlock({ startMs: 10_000, endMs: 25_000 }),
  makeTranscriptBlock({ startMs: 30_000, endMs: 40_000 }),
  makeTranscriptBlock({ startMs: 40_000, endMs: 55_000 }),
];

describe("chapterBlockRun", () => {
  it("has no run for a transcript with no blocks", () => {
    expect(chapterBlockRun([], { startMs: 0, endMs: 10_000 })).toBeNull();
  });

  it("runs from the chapter's first block to its last", () => {
    expect(chapterBlockRun(BLOCKS, { startMs: 10_000, endMs: 40_000 })).toEqual({ from: 1, to: 2 });
  });

  it("is one block for a chapter inside one", () => {
    expect(chapterBlockRun(BLOCKS, { startMs: 0, endMs: 10_000 })).toEqual({ from: 0, to: 0 });
  });

  it("leaves out a block that begins exactly where the chapter ends", () => {
    expect(chapterBlockRun(BLOCKS, { startMs: 0, endMs: 30_000 })).toEqual({ from: 0, to: 1 });
  });

  // A chapter's last words run on into a block the next chapter also starts in, so both
  // runs hold it. One chapter is marked at a time, so the overlap is never drawn.
  it("keeps a block the chapter ends part-way through", () => {
    expect(chapterBlockRun(BLOCKS, { startMs: 0, endMs: 35_000 })).toEqual({ from: 0, to: 2 });
    expect(chapterBlockRun(BLOCKS, { startMs: 35_000, endMs: 55_000 })).toEqual({ from: 2, to: 3 });
  });

  it("starts at the block the chapter's first words fall inside, not the one after", () => {
    expect(chapterBlockRun(BLOCKS, { startMs: 15_000, endMs: 40_000 })).toEqual({ from: 1, to: 2 });
  });

  it("reaches the last block for a chapter ending after every block has begun", () => {
    expect(chapterBlockRun(BLOCKS, { startMs: 40_000, endMs: 55_000 })).toEqual({ from: 3, to: 3 });
  });

  it("has no run for a chapter beginning before the first block does", () => {
    expect(chapterBlockRun([makeTranscriptBlock({ startMs: 4000, endMs: 9000 })], { startMs: 0, endMs: 4000 })).toBeNull();
  });
});
