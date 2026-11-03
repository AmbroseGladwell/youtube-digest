import { describe, expect, it } from "vitest";
import { aboutYouSuggestionGroups } from "./aboutYouCopy.js";

describe("aboutYouSuggestionGroups", () => {
  it("opens focusing on with the topics picked, in the order they're offered, then life goals", () => {
    const groups = aboutYouSuggestionGroups("focus", ["food", "Finance", "chess"]);

    expect(groups.map(({ name }) => name)).toEqual(["From Finance", "From Food", "Life"]);
    expect(groups[0]?.entries).toEqual(["money", "investing"]);
  });

  it("offers general goals when no topics were picked", () => {
    expect(aboutYouSuggestionGroups("focus", []).map(({ name }) => name)).toEqual(["Life", "Learning"]);
  });

  it("offers the same groups for who you are whatever was picked", () => {
    expect(aboutYouSuggestionGroups("who", ["Food"]).map(({ name }) => name)).toEqual(["Family and home", "Where you are in life"]);
  });
});
