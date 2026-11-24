import { describe, expect, it } from "vitest";
import { cappedTags } from "./cappedTags.js";

const TAGS = ["one", "two", "three", "four", "five", "six", "seven", "eight"].map((tag, index) => ({
  tag,
  count: 8 - index,
}));

describe("cappedTags", () => {
  it("stops at the limit and counts what it held back", () => {
    const { shown, hiddenCount } = cappedTags(TAGS, []);

    expect(shown.map(({ tag }) => tag)).toEqual(["one", "two", "three", "four", "five", "six"]);
    expect(hiddenCount).toBe(2);
  });

  it("keeps the tags being filtered by visible, even from beyond the limit", () => {
    const { shown, hiddenCount } = cappedTags(TAGS, ["seven", "eight"]);

    expect(shown.map(({ tag }) => tag)).toEqual(expect.arrayContaining(["seven", "eight"]));
    expect(hiddenCount).toBe(0);
  });
});
