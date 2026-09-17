import { describe, expect, it } from "vitest";
import { makeOverview } from "../../overviews/types/OverviewFactory.testHelper.js";
import { makeNewOverviewRun } from "../types/NewOverviewRunFactory.testHelper.js";
import { generationRunStatus } from "./generationRunStatus.js";

describe("generationRunStatus", () => {
  it("names the step that is actually running, and counts it out of the steps there are", () => {
    expect(generationRunStatus(makeNewOverviewRun())).toMatchObject({
      label: "Fetching transcript",
      step: "Step 1 of 2",
      isRunning: true,
    });

    expect(generationRunStatus(makeNewOverviewRun({ transcriptWords: 1412 }))).toMatchObject({
      label: "Creating overview",
      step: "Step 2 of 2",
    });
  });

  it("only ever advances the rule on a step that finished", () => {
    expect(generationRunStatus(makeNewOverviewRun()).progressFraction).toBe(0.25);
    expect(generationRunStatus(makeNewOverviewRun({ transcriptWords: 1 })).progressFraction).toBe(0.75);
    expect(
      generationRunStatus(makeNewOverviewRun({ transcriptWords: 1, overview: makeOverview() }))
        .progressFraction,
    ).toBe(1);
  });

  it("turns into the ready state once there is an overview", () => {
    expect(generationRunStatus(makeNewOverviewRun({ overview: makeOverview() }))).toMatchObject({
      label: "Overview ready",
      step: "Done",
      isReady: true,
      isRunning: false,
    });
  });

  it("says where a failure stopped, and is neither running nor ready", () => {
    expect(generationRunStatus(makeNewOverviewRun({ error: "Unauthorized" }))).toMatchObject({
      label: "Couldn't create the overview",
      step: "Stopped at step 1 of 2",
      isFailed: true,
      isRunning: false,
      isReady: false,
    });
  });
});
