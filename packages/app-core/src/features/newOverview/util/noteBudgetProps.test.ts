import { describe, expect, it } from "vitest";
import { makeArticleOverview, makeOverview, makeRecipeOverview } from "../../overviews/types/OverviewFactory.testHelper.js";
import { noteBudgetProps } from "./noteBudgetProps.js";

const chapter = (startMs: number) => ({ title: "A chapter", summary: "What it covers.", startMs, endMs: startMs + 60_000 });

describe("noteBudgetProps", () => {
  it("counts a two hour video against the long budget", () => {
    const overview = makeOverview({ chapters: [chapter(0), chapter(60_000)] });
    expect(noteBudgetProps(overview, 18_000)).toEqual({ sourceWords: 18_000, keyPoints: 3, keyPointCeiling: 10, chapters: 2 });
  });

  it("counts a short video against the seven it always had", () => {
    expect(noteBudgetProps(makeOverview(), 1_500)).toMatchObject({ keyPointCeiling: 7, chapters: 0 });
  });

  it("counts an article against the written budget and its own chapters", () => {
    expect(noteBudgetProps(makeArticleOverview(), 3_220)).toMatchObject({ keyPointCeiling: 6, chapters: 3 });
  });

  it("counts a heading-dense article against the row above its length", () => {
    expect(noteBudgetProps(makeArticleOverview(), 1_401, 8)).toMatchObject({ keyPointCeiling: 6 });
  });

  it("says nothing for a recipe page, which has no key points, or when the length is unknown", () => {
    const nothing = { sourceWords: undefined, keyPoints: undefined, keyPointCeiling: undefined, chapters: undefined };
    expect(noteBudgetProps(makeRecipeOverview(), 900)).toEqual(nothing);
    expect(noteBudgetProps(makeOverview(), null)).toEqual(nothing);
  });
});
