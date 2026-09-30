import test from "node:test";
import assert from "node:assert/strict";
import { makeOverview } from "./OverviewFactory.testHelper.js";
import { overviewMetaParts } from "./overviewMetaParts.js";

test("a library row, its note and its shared page read the same three numbers", () => {
  const overview = makeOverview({
    video: { ...makeOverview().video, durationMs: 698_000 },
    keyPoints: ["one", "two", "three"],
  });

  assert.deepEqual(overviewMetaParts(overview), ["1 min read", "1 min listen", "11:38 video"]);
});
