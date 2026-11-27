import { describe, expect, it } from "vitest";
import { placedMarks } from "./inlineMarks.js";
import { groupBySentence, sentencePieces } from "./sentencePieces.js";

const shown = (text: string, ranges: Array<{ index: number; start: number; end: number }>) =>
  groupBySentence(sentencePieces(placedMarks(text), ranges))
    .map(({ sentence, pieces }) => `${sentence ?? "-"}:${pieces.map((piece) => piece.text).join("")}`)
    .join("|");

describe("sentencePieces", () => {
  it("splits a paragraph into its sentences, keeping what lies between them plain", () => {
    expect(
      shown("Drink water. Then **rest well** today.", [
        { index: 4, start: 0, end: 12 },
        { index: 5, start: 13, end: 38 },
      ]),
    ).toBe("4:Drink water.|-: |5:Then rest well today.");
  });

  it("gives a link to the sentence it sits in, whole", () => {
    expect(shown("See [the docs](https://example.com) now.", [{ index: 0, start: 0, end: 40 }])).toBe("0:See the docs now.");
  });

  it("leaves text no sentence covers plain", () => {
    expect(shown("- A list item.", [{ index: 2, start: 2, end: 14 }])).toBe("-:- |2:A list item.");
  });
});
