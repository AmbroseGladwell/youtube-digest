import { describe, expect, it } from "vitest";
import {
  makeArticleOverview,
  makeOverview,
  makePodcastOverview,
  makeRecipeOverview,
} from "../../overviews/types/OverviewFactory.testHelper.js";
import { mixedByKind } from "./mixedByKind.js";

describe("mixedByKind", () => {
  it("takes one of each kind in turn, keeping each kind's own order", () => {
    const samples = [
      { name: "video 1", note: makeOverview() },
      { name: "video 2", note: makeOverview() },
      { name: "recipe 1", note: makeRecipeOverview() },
      { name: "article 1", note: makeArticleOverview() },
      { name: "podcast 1", note: makePodcastOverview() },
      { name: "recipe 2", note: makeRecipeOverview() },
    ];
    expect(mixedByKind(samples).map(({ name }) => name)).toEqual(["video 1", "article 1", "podcast 1", "recipe 1", "video 2", "recipe 2"]);
  });
});
