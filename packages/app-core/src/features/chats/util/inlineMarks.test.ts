import { describe, expect, it } from "vitest";
import { inlineMarks, markedWords } from "./inlineMarks.js";

describe("inlineMarks", () => {
  it("bolds what sits between double asterisks and drops the asterisks", () => {
    expect(inlineMarks("Start with **one habit** a day.")).toEqual([
      { text: "Start with ", bold: false },
      { text: "one habit", bold: true },
      { text: " a day.", bold: false },
    ]);
  });

  it("reads a pair still open as plain once whole, and as bold while it streams", () => {
    expect(inlineMarks("Try **this")).toEqual([
      { text: "Try ", bold: false },
      { text: "this", bold: false },
    ]);
    expect(inlineMarks("Try **this", { open: "bold" })).toEqual([
      { text: "Try ", bold: false },
      { text: "this", bold: true },
    ]);
  });

  it("marks words as they arrive, never showing the asterisks", () => {
    expect(markedWords(["Read ", "**Happy ", "couples** ", "first."], false)).toEqual([
      { text: "Read ", bold: false },
      { text: "Happy ", bold: true },
      { text: "couples", bold: true },
      { text: " ", bold: false },
      { text: "first.", bold: false },
    ]);
  });
});
