import { describe, expect, it } from "vitest";
import { aboutYouLine, toggledGoals } from "./aboutYou.js";

describe("aboutYouLine", () => {
  it("is empty with nothing picked", () => {
    expect(aboutYouLine(null, [])).toBe("");
  });

  it("names the role alone", () => {
    expect(aboutYouLine("Healthcare", [])).toBe("Works in healthcare.");
  });

  it("joins the role and up to two goals", () => {
    expect(aboutYouLine("Healthcare", ["Cooking", "A language"])).toBe(
      "Works in healthcare, learning about cooking and a language.",
    );
  });

  it("reads with goals alone", () => {
    expect(aboutYouLine(null, ["Money"])).toBe("Learning about money.");
  });
});

describe("toggledGoals", () => {
  it("adds and removes a goal", () => {
    expect(toggledGoals(["Money"], "Tech")).toEqual(["Money", "Tech"]);
    expect(toggledGoals(["Money", "Tech"], "Money")).toEqual(["Tech"]);
  });

  it("lets a third goal take the place of the oldest", () => {
    expect(toggledGoals(["Money", "Tech"], "Cooking")).toEqual(["Tech", "Cooking"]);
  });
});
