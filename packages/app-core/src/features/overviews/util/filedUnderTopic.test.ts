import { describe, it, expect } from "vitest";
import { TopicId } from "@overview/domain";
import { makeOverview } from "../types/OverviewFactory.testHelper.js";
import { filedUnderTopic, unfiledFromTopic } from "./filedUnderTopic.js";

const COOKING = TopicId.parse(crypto.randomUUID());
const FITNESS = TopicId.parse(crypto.randomUUID());

describe("filedUnderTopic", () => {
  it("keeps the topics the overview already had", () => {
    const overview = makeOverview({ topicIds: [FITNESS] });

    expect(filedUnderTopic(overview, COOKING).topicIds).toEqual([FITNESS, COOKING]);
  });

  it("files under a topic it already carries only once", () => {
    const overview = makeOverview({ topicIds: [FITNESS] });

    expect(filedUnderTopic(overview, FITNESS).topicIds).toEqual([FITNESS]);
  });
});

describe("unfiledFromTopic", () => {
  it("removes only the topic named", () => {
    const overview = makeOverview({ topicIds: [FITNESS, COOKING] });

    expect(unfiledFromTopic(overview, FITNESS).topicIds).toEqual([COOKING]);
  });

  it("is a no-op for a topic the overview isn't in", () => {
    const overview = makeOverview({ topicIds: [FITNESS] });

    expect(unfiledFromTopic(overview, COOKING).topicIds).toEqual([FITNESS]);
  });
});
