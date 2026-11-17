import { describe, expect, it } from "vitest";
import { makeOverviewWithState } from "../../overviews/types/OverviewFactory.testHelper.js";
import { PROJECT_SUGGESTIONS, projectSuggestionQuery, projectSuggestions } from "./projectSuggestions.js";

const saved = Array.from({ length: 8 }, () => makeOverviewWithState());
const ids = saved.map(({ overview }) => overview.id as string);
const matched = (overviewIds: string[]) => ({
  available: true as const,
  matches: overviewIds.map((overviewId, index) => ({ overviewId, similarity: 0.9 - index / 100 })),
});
const none = new Set<string>();

describe("projectSuggestionQuery", () => {
  it("searches by the name and what the project is for, or by the name alone", () => {
    expect(projectSuggestionQuery({ name: "Kitchen renovation", purpose: "A galley kitchen on a budget." })).toBe(
      "Kitchen renovation. A galley kitchen on a budget.",
    );
    expect(projectSuggestionQuery({ name: "Pension", purpose: null })).toBe("Pension");
  });
});

describe("projectSuggestions", () => {
  it("offers the closest first, at most five", () => {
    const offered = projectSuggestions({ result: matched(ids), overviews: saved, inProject: none, takenOut: none });
    expect(offered.map(({ overview }) => overview.id)).toEqual(ids.slice(0, PROJECT_SUGGESTIONS));
  });

  it("never offers an overview already in the project or one taken out of it, and fills from further down", () => {
    const offered = projectSuggestions({
      result: matched(ids.slice(0, 6)),
      overviews: saved,
      inProject: new Set([ids[0]!]),
      takenOut: new Set([ids[2]!]),
    });
    expect(offered.map(({ overview }) => overview.id)).toEqual([ids[1], ids[3], ids[4], ids[5]]);
  });

  it("offers nothing the library doesn't hold, and nothing when meaning is unavailable", () => {
    expect(projectSuggestions({ result: matched(["elsewhere"]), overviews: saved, inProject: none, takenOut: none })).toEqual([]);
    expect(projectSuggestions({ result: { available: false }, overviews: saved, inProject: none, takenOut: none })).toEqual([]);
    expect(projectSuggestions({ result: undefined, overviews: saved, inProject: none, takenOut: none })).toEqual([]);
  });
});
