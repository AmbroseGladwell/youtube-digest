import { describe, expect, it } from "vitest";
import { shareSnapshot, type Overview } from "@overview/domain";
import { makeArticleOverview, makeOverview, makeRecipeOverview } from "../../overviews/types/OverviewFactory.testHelper.js";
import { sampleFacts } from "./sampleFacts.js";

const noteOf = (overview: Overview) => shareSnapshot({ overview, transcript: null, narration: null }).note;

describe("sampleFacts", () => {
  it("names a video by its title, kind and running time, and puts Watch Less in the headline", () => {
    const video = makeOverview({ source: { ...makeOverview().source, title: "A Talk", channel: "Ch", durationMs: 754_000 } });
    expect(sampleFacts(noteOf(video))).toMatchObject({
      kindLabel: "Video",
      source: "Ch",
      length: "12:34",
      verb: "Watch Less,",
      name: "A Talk, Video, 12:34",
      first: { label: "Premise", text: video.inOneLine },
      sections: ["Key points", "How to apply", "Verdict"],
    });
  });

  it("gives an article its read time and Learn More", () => {
    expect(sampleFacts(noteOf(makeArticleOverview()))).toMatchObject({
      kindLabel: "Article",
      source: "The Harbour Post",
      length: "14 min read",
      verb: "Learn More,",
    });
  });

  it("gives a recipe its total time, its Summary and Cook More", () => {
    const recipe = makeRecipeOverview();
    expect(sampleFacts(noteOf(recipe))).toMatchObject({
      kindLabel: "Recipe",
      length: "1 hr 5 min",
      verb: "Cook More,",
      first: { label: "Summary", text: recipe.recipe!.summary },
      sections: ["Ingredients", "Method"],
    });
  });

  it("leaves the length out of a recipe whose page gives no total time", () => {
    const recipe = makeRecipeOverview();
    const untimed = makeRecipeOverview({ recipe: { ...recipe.recipe!, totalMinutes: null } });
    const facts = sampleFacts(noteOf(untimed));
    expect(facts.length).toBeNull();
    expect(facts.name).toBe("Charred leek and white bean stew, Recipe");
  });
});
