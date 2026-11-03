import { describe, expect, it } from "vitest";
import { makeOverview } from "../../overviews/types/OverviewFactory.testHelper.js";
import { makeNewOverviewRun } from "../types/NewOverviewRunFactory.testHelper.js";
import { generationRunSteps } from "./generationRunSteps.js";

describe("generationRunSteps", () => {
  it("has no audio step, because narration is asked for without anyone waiting on it", () => {
    expect(generationRunSteps(makeNewOverviewRun()).map((step) => step.label)).toEqual([
      "Fetching transcript",
      "Creating overview",
    ]);
  });

  const articleRun = (oneTimeAccess = false) => ({
    title: "A story",
    site: "example.com",
    words: null,
    asking: false,
    oneTimeAccess,
    fetched: false,
    recipe: null,
    regenerating: false,
    failure: null,
  });

  it("names an article's read, and gives its word count once read", () => {
    expect(generationRunSteps(makeNewOverviewRun({ article: articleRun() })).map((step) => step.label)).toEqual([
      "Reading the article",
      "Writing the overview",
    ]);
    const [read, write] = generationRunSteps(makeNewOverviewRun({ article: articleRun(), transcriptWords: 3200 }));
    expect(read).toMatchObject({ detail: "3,200 words", state: "done" });
    expect(write?.state).toBe("running");
  });

  it("says fetching for a pasted link, which our server read", () => {
    expect(generationRunSteps(makeNewOverviewRun({ article: { ...articleRun(), fetched: true } }))[0]?.label).toBe("Fetching the article");
  });

  it("says this page on the right-click route, where we don't yet know it's an article", () => {
    expect(generationRunSteps(makeNewOverviewRun({ article: articleRun(true) }))[0]?.label).toBe("Reading this page");
  });

  it("names a recipe once the page is read as one, with its counts", () => {
    const run = makeNewOverviewRun({ article: { ...articleRun(), recipe: { ingredients: 10, steps: 6 } }, transcriptWords: 900 });
    expect(generationRunSteps(run)[0]).toMatchObject({ label: "Reading the recipe", detail: "10 ingredients, 6 steps" });
    const fetched = makeNewOverviewRun({ article: { ...articleRun(), fetched: true, recipe: { ingredients: 1, steps: 1 } } });
    expect(generationRunSteps(fetched)[0]).toMatchObject({ label: "Fetching the recipe", detail: "1 ingredient, 1 step" });
  });

  it("starts with the transcript running and the overview queued", () => {
    const [transcript, overview] = generationRunSteps(makeNewOverviewRun());

    expect(transcript!.state).toBe("running");
    expect(overview!.state).toBe("waiting");
    expect(overview!.detail).toBe("Queued");
  });

  it("reports what the transcript step produced, not that it was working", () => {
    const steps = generationRunSteps(makeNewOverviewRun({ transcriptWords: 1412 }));

    expect(steps[0]!.detail).toBe("Transcript fetched · 1,412 words");
    expect(steps[0]!.state).toBe("done");
    expect(steps[1]!.state).toBe("running");
  });

  it("reports the finished overview's own read time, counted from its words", () => {
    const steps = generationRunSteps(
      makeNewOverviewRun({ transcriptWords: 1412, overview: makeOverview() }),
    );

    expect(steps[1]!.detail).toBe("Overview written · 1 min read");
    expect(steps.every((step) => step.state === "done")).toBe(true);
  });
});
