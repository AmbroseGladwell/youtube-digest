import { describe, expect, it } from "vitest";
import { streamedParagraphs } from "./streamedParagraphs.js";

describe("streamedParagraphs", () => {
  it("holds back a word still being written", () => {
    expect(streamedParagraphs("Check the cereal lab", false)).toEqual([["Check ", "the ", "cereal "]]);
  });

  it("shows the last word once it is whole", () => {
    expect(streamedParagraphs("Check the cereal label", true)).toEqual([["Check ", "the ", "cereal ", "label"]]);
    expect(streamedParagraphs("Check the cereal label ", false)).toEqual([["Check ", "the ", "cereal ", "label "]]);
  });

  it("splits paragraphs as the final answer does", () => {
    expect(streamedParagraphs("First one.\n\nSecond one.", true)).toEqual([
      ["First ", "one."],
      ["Second ", "one."],
    ]);
  });

  it("keeps a word's place as more text arrives, so a shown word never changes", () => {
    const earlier = streamedParagraphs("Start with eggs and be", false);
    const later = streamedParagraphs("Start with eggs and beans.\n\nThen greens", false);
    expect(later[0]?.slice(0, earlier[0]?.length)).toEqual(earlier[0]);
  });

  it("shows nothing until the first word is whole", () => {
    expect(streamedParagraphs("Sta", false)).toEqual([]);
    expect(streamedParagraphs("", true)).toEqual([]);
  });
});
