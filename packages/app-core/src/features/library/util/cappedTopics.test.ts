import { describe, it, expect } from "vitest";
import { TopicId } from "@overview/types";
import { makeTopic } from "../../overviews/types/TopicFactory.testHelper.js";
import { cappedTopics } from "./cappedTopics.js";

const TOPICS = ["one", "two", "three", "four", "five", "six", "seven", "eight"].map((name) =>
  makeTopic({ name }),
);

describe("cappedTopics", () => {
  it("shows every topic when there are fewer than the limit, and hides nothing", () => {
    const { shown, hiddenCount } = cappedTopics(TOPICS.slice(0, 3), "all");

    expect(shown.map((topic) => topic.name)).toEqual(["one", "two", "three"]);
    expect(hiddenCount).toBe(0);
  });

  it("stops at the limit and counts what it held back", () => {
    const { shown, hiddenCount } = cappedTopics(TOPICS, "all");

    expect(shown.map((topic) => topic.name)).toEqual(["one", "two", "three", "four", "five", "six"]);
    expect(hiddenCount).toBe(2);
  });

  // A filter you cannot see is a filter you cannot clear.
  it("keeps the topic being filtered by visible, even from beyond the limit", () => {
    const { shown, hiddenCount } = cappedTopics(TOPICS, TOPICS[7]!.id);

    expect(shown.map((topic) => topic.name)).toContain("eight");
    expect(hiddenCount).toBe(1);
  });

  it("holds nothing back once the selected topic was already inside the limit", () => {
    const { shown, hiddenCount } = cappedTopics(TOPICS.slice(0, 7), TOPICS[0]!.id);

    expect(shown).toHaveLength(6);
    expect(hiddenCount).toBe(1);
  });

  it("ignores a selected topic that is no longer in the list", () => {
    const { hiddenCount } = cappedTopics(TOPICS, TopicId.parse(crypto.randomUUID()));

    expect(hiddenCount).toBe(2);
  });
});
