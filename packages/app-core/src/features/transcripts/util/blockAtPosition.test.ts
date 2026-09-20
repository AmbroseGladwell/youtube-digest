import { describe, expect, it } from "vitest";
import { makeTranscriptBlock } from "../types/TranscriptBlockFactory.testHelper.js";
import { blockAtPosition } from "./blockAtPosition.js";

const BLOCKS = [
  makeTranscriptBlock({ startMs: 0, endMs: 10_000 }),
  makeTranscriptBlock({ startMs: 10_000, endMs: 25_000 }),
  makeTranscriptBlock({ startMs: 30_000, endMs: 40_000 }),
];

describe("blockAtPosition", () => {
  it("has no block for a transcript with none", () => {
    expect(blockAtPosition([], 5000)).toBe(-1);
  });

  it("finds the block the position sits inside", () => {
    expect(blockAtPosition(BLOCKS, 12_000)).toBe(1);
  });

  it("counts a block's own start as inside it", () => {
    expect(blockAtPosition(BLOCKS, 10_000)).toBe(1);
  });

  // The gap between two blocks is a stretch of dropped annotation or silence, and the
  // reader is still on the last thing that was said (docs/features/transcript-storage.md).
  it("stays on the last block passed while the position is in a gap between two", () => {
    expect(blockAtPosition(BLOCKS, 27_000)).toBe(1);
  });

  it("stays on the last block once the position is past all of them", () => {
    expect(blockAtPosition(BLOCKS, 90_000)).toBe(2);
  });

  it("has no block before the first one begins", () => {
    expect(blockAtPosition([makeTranscriptBlock({ startMs: 4000, endMs: 9000 })], 1000)).toBe(-1);
  });
});
