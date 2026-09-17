import { describe, expect, it } from "vitest";
import { countWords } from "./countWords.js";

describe("countWords", () => {
  it("counts whitespace-separated words, ignoring runs of whitespace", () => {
    expect(countWords("  one   two\nthree ")).toBe(3);
    expect(countWords("   ")).toBe(0);
  });
});
