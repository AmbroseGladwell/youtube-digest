import { describe, expect, it } from "vitest";
import { cappedTags } from "./cappedTags.js";

const TAGS = ["one", "two", "three", "four", "five", "six", "seven", "eight"].map((tag, index) => ({
  tag,
  count: 8 - index,
}));

describe("cappedTags", () => {
  it("stops at the limit and counts what it held back", () => {
    const { shown, hiddenCount } = cappedTags(TAGS, null);

    expect(shown.map(({ tag }) => tag)).toEqual(["one", "two", "three", "four", "five", "six"]);
    expect(hiddenCount).toBe(2);
  });

  it("keeps the tag being filtered by visible, even from beyond the limit", () => {
    const { shown, hiddenCount } = cappedTags(TAGS, "eight");

    expect(shown.map(({ tag }) => tag)).toContain("eight");
    expect(hiddenCount).toBe(1);
  });
});
