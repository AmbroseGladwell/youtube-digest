import test from "node:test";
import assert from "node:assert/strict";
import { makeOverview } from "./OverviewFactory.testHelper.js";
import { overviewMetaParts } from "./overviewMetaParts.js";

test("a library row, its note and its shared page read the same three numbers", () => {
  const overview = makeOverview({
    source: { ...makeOverview().source, durationMs: 698_000 },
    keyPoints: [
      { text: "one", range: null },
      { text: "two", range: null },
      { text: "three", range: null },
    ],
  });

  assert.deepEqual(overviewMetaParts(overview), ["1 min read", "1 min listen", "11:38 video"]);
});

test("a row whose video has no stored duration still names the kind", () => {
  assert.equal(overviewMetaParts(makeOverview()).at(-1), "Video");
});
