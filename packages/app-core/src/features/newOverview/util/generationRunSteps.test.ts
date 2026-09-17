import { describe, expect, it } from "vitest";
import { makeOverview } from "../../overviews/types/OverviewFactory.testHelper.js";
import { makeNewOverviewRun } from "../types/NewOverviewRunFactory.testHelper.js";
import { generationRunSteps } from "./generationRunSteps.js";

describe("generationRunSteps", () => {
  it("has no audio step, because there is no narrated audio to render", () => {
    expect(generationRunSteps(makeNewOverviewRun()).map((step) => step.label)).toEqual([
      "Fetching transcript",
      "Creating overview",
    ]);
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
