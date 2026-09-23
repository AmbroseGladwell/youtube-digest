import { describe, it, expect } from "vitest";
import { TopicId, type Topic } from "@overview/domain";
import { creatableTopicName, topicMatches } from "./topicMatches.js";

const topic = (name: string): Topic => ({
  id: TopicId.parse(crypto.randomUUID()),
  name,
  description: null,
  createdAt: new Date().toISOString(),
});

const TOPICS = [topic("clean tech"), topic("nuclear"), topic("politics")];

describe("topicMatches", () => {
  it("matches anywhere in the name, not only at the start", () => {
    expect(topicMatches(TOPICS, "cl").map((match) => match.topic.name)).toEqual([
      "clean tech",
      "nuclear",
    ]);
  });

  it("splits the name around the match, so the typed part can be marked", () => {
    const [cleanTech, nuclear] = topicMatches(TOPICS, "cl");

    expect(cleanTech).toMatchObject({ before: "", matched: "cl", after: "ean tech" });
    expect(nuclear).toMatchObject({ before: "nu", matched: "cl", after: "ear" });
  });

  it("marks nothing on an empty query, and keeps every topic", () => {
    expect(topicMatches(TOPICS, "  ")).toEqual([
      { topic: TOPICS[0], before: "clean tech", matched: "", after: "" },
      { topic: TOPICS[1], before: "nuclear", matched: "", after: "" },
      { topic: TOPICS[2], before: "politics", matched: "", after: "" },
    ]);
  });

  it("ignores case on both sides", () => {
    expect(topicMatches([topic("Clean Tech")], "clean").map((m) => m.matched)).toEqual(["Clean"]);
  });
});

describe("creatableTopicName", () => {
  it("offers the trimmed query as a new topic", () => {
    expect(creatableTopicName(TOPICS, "  climate ")).toBe("climate");
  });

  it("offers nothing when a topic of that name already exists, whatever its casing", () => {
    expect(creatableTopicName(TOPICS, "Clean Tech")).toBeNull();
  });

  it("offers nothing for an empty query", () => {
    expect(creatableTopicName(TOPICS, "   ")).toBeNull();
  });
});
