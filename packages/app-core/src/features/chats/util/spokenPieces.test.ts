import { describe, expect, it } from "vitest";
import { placedMarks } from "./inlineMarks.js";
import { spokenPieces } from "./spokenPieces.js";

const shown = (text: string, range: { start: number; end: number } | null) =>
  spokenPieces(placedMarks(text), range)
    .map(({ piece, spoken }) => (spoken ? `[${piece.text}]` : piece.text))
    .join("");

describe("spokenPieces", () => {
  it("marks only the sentence being read, by its place in the marked text", () => {
    const text = "Drink water. Then **rest well** today. Sleep.";

    expect(shown(text, { start: 13, end: 38 })).toBe("Drink water. [Then ][rest well][ today.] Sleep.");
  });

  it("keeps the marks of the words it cuts", () => {
    const pieces = spokenPieces(placedMarks("A **bold claim** here."), { start: 0, end: 9 });

    expect(pieces.map(({ piece, spoken }) => [piece.text, piece.bold, spoken])).toEqual([
      ["A ", false, true],
      ["bold ", true, true],
      ["claim", true, false],
      [" here.", false, false],
    ]);
  });

  it("speaks a link or inline code whole when the sentence touches it", () => {
    expect(shown("See [the docs](https://example.com) now. Run `npm test` after.", { start: 0, end: 40 })).toBe(
      "[See ][the docs][ now.] Run npm test after.",
    );
  });

  it("marks nothing when nothing is being read", () => {
    expect(shown("Plain words.", null)).toBe("Plain words.");
  });
});
