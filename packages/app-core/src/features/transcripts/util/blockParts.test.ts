import { describe, expect, it } from "vitest";
import { blockParts } from "./blockParts.js";

describe("blockParts", () => {
  it("returns the whole text as one unmarked part when nothing matched", () => {
    expect(blockParts("Nothing here.", [])).toEqual([{ text: "Nothing here.", match: null }]);
  });

  it("splits the text around a hit in the middle", () => {
    expect(blockParts("a hit here", [{ index: 3, blockIndex: 0, start: 2, end: 5 }])).toEqual([
      { text: "a ", match: null },
      { text: "hit", match: 3 },
      { text: " here", match: null },
    ]);
  });

  it("leaves no empty part when a hit opens or closes the text", () => {
    expect(blockParts("hit", [{ index: 0, blockIndex: 0, start: 0, end: 3 }])).toEqual([
      { text: "hit", match: 0 },
    ]);
  });

  it("carries each hit's own number through, not its place in this block", () => {
    const parts = blockParts("ab ab", [
      { index: 7, blockIndex: 1, start: 0, end: 2 },
      { index: 8, blockIndex: 1, start: 3, end: 5 },
    ]);

    expect(parts.map((part) => part.match)).toEqual([7, null, 8]);
  });
});
