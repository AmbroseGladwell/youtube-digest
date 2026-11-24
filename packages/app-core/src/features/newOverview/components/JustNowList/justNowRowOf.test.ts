import { describe, expect, it } from "vitest";
import { makeOverview } from "../../../overviews/types/OverviewFactory.testHelper.js";
import { makeNewOverviewRun } from "../../types/NewOverviewRunFactory.testHelper.js";
import { justNowRowOf } from "./justNowRowOf.js";

describe("justNowRowOf", () => {
  it("is fetching, step 1 of 2, by the link's address before anything is known about it", () => {
    const row = justNowRowOf(makeNewOverviewRun({ url: "https://www.youtube.com/watch?v=abc123def45" }));
    expect(row).toMatchObject({ stage: "fetch", step: 1, steps: 2, kicker: "youtube.com", label: "Fetching transcript" });
  });

  it("is writing, step 2 of 2, once the words are in, under the video's own title", () => {
    const { source } = makeOverview();
    const row = justNowRowOf(makeNewOverviewRun({ video: source, transcriptWords: 1529 }));
    expect(row).toMatchObject({ stage: "write", step: 2, steps: 2, title: source.title, kicker: source.channel });
  });

  it("is done, past its last step, with what the last step says", () => {
    const overview = makeOverview();
    const row = justNowRowOf(makeNewOverviewRun({ video: overview.source, transcriptWords: 900, overview, finishedAt: 1 }));
    expect(row.stage).toBe("done");
    expect(row.step).toBe(3);
    expect(row.detail).toMatch(/^Overview written · \d+ min read$/);
  });

  it("is failed whatever else it got through", () => {
    expect(justNowRowOf(makeNewOverviewRun({ error: { kind: "message", message: "No" }, finishedAt: 1 })).stage).toBe("failed");
  });
});
