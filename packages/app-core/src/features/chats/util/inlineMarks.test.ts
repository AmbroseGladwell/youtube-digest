import { describe, expect, it } from "vitest";
import { inlineMarks, markedWords } from "./inlineMarks.js";

const plain = { bold: false, italic: false, code: false };

describe("inlineMarks", () => {
  it("bolds what sits between double asterisks and drops the asterisks", () => {
    expect(inlineMarks("Start with **one habit** a day.")).toEqual([
      { ...plain, text: "Start with " },
      { ...plain, text: "one habit", bold: true },
      { ...plain, text: " a day." },
    ]);
  });

  it("reads italics, inline code and safe links, and leaves raw HTML as text", () => {
    expect(inlineMarks("Run `npm test`, *then* see [the docs](https://example.com/a) <b>now</b>")).toEqual([
      { ...plain, text: "Run " },
      { ...plain, text: "npm test", code: true },
      { ...plain, text: ", " },
      { ...plain, text: "then", italic: true },
      { ...plain, text: " see " },
      { ...plain, text: "the docs", href: "https://example.com/a" },
      { ...plain, text: " <b>now</b>" },
    ]);
  });

  it("keeps a link's words but drops an address that isn't http(s), and leaves snake_case alone", () => {
    expect(inlineMarks("[click](javascript:alert(1)) my_var_name")).toEqual([
      { ...plain, text: "click" },
      { ...plain, text: ") my_var_name" },
    ]);
  });

  it("reads a mark still open as plain once whole, and as marked while it streams", () => {
    expect(inlineMarks("Try **this")).toEqual([
      { ...plain, text: "Try " },
      { ...plain, text: "this" },
    ]);
    expect(inlineMarks("Try **this", { open: "bold" })).toEqual([
      { ...plain, text: "Try " },
      { ...plain, text: "this", bold: true },
    ]);
    expect(inlineMarks("Run `npm te", { open: "bold" })).toEqual([
      { ...plain, text: "Run " },
      { ...plain, text: "npm te", code: true },
    ]);
    expect(inlineMarks("See [the do", { open: "bold" })).toEqual([{ ...plain, text: "See the do" }]);
  });

  it("marks words as they arrive, never showing the markers", () => {
    expect(markedWords(["Read ", "**Happy ", "couples** ", "first."], false)).toEqual([
      { ...plain, text: "Read " },
      { ...plain, text: "Happy ", bold: true },
      { ...plain, text: "couples", bold: true },
      { ...plain, text: " " },
      { ...plain, text: "first." },
    ]);
  });
});
