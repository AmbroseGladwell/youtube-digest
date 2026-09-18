import { describe, it, expect } from "vitest";
import { TopicId } from "@overview/types";
import { makeOverview } from "../types/OverviewFactory.testHelper.js";
import { topicCounts, unsortedOverviews } from "./topicCounts.js";

const COOKING = TopicId.parse(crypto.randomUUID());
const FITNESS = TopicId.parse(crypto.randomUUID());

describe("topicCounts", () => {
  it("counts an overview once per topic it sits in", () => {
    const counts = topicCounts([
      makeOverview({ topicIds: [COOKING, FITNESS] }),
      makeOverview({ topicIds: [COOKING] }),
      makeOverview({ topicIds: [] }),
    ]);

    expect(counts).toEqual({ [COOKING]: 2, [FITNESS]: 1 });
  });
});

describe("unsortedOverviews", () => {
  it("is the overviews in no topic at all", () => {
    const unsorted = makeOverview({ topicIds: [] });

    expect(unsortedOverviews([makeOverview({ topicIds: [COOKING] }), unsorted])).toEqual([unsorted]);
  });
});
