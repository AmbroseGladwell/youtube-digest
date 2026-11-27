import { describe, expect, it } from "vitest";
import { TopicId, type Topic } from "@overview/domain";
import {
  borrowNote,
  deleteCopy,
  deletedNotice,
  descriptionChange,
  descriptionNeedsLook,
  filedUnderAny,
  leftWithoutTopic,
  mergeDefaults,
  mergeTarget,
  mergedNotice,
  renameCheck,
  summaryLine,
  topicUsage,
} from "./manageTopics.js";

const topic = (name: string, description: string | null = null): Topic => ({
  id: TopicId.parse(crypto.randomUUID()),
  name,
  description,
  createdAt: "2026-11-27T08:00:00.000Z",
});

const health = topic("Health", "Wellbeing, illness and medical care.");
const fitness = topic("Fitness", "Exercise, training and sport.");
const parenting = topic("Parenting");
const film = topic("Film", "Films, including TV.");

describe("topicUsage", () => {
  it("counts each topic's overviews, most used first and then by name", () => {
    const usage = topicUsage(
      [parenting, health, fitness],
      [{ topicIds: [health.id] }, { topicIds: [health.id, fitness.id] }, { topicIds: [] }],
    );

    expect(usage.map(({ topic: { name }, count }) => [name, count])).toEqual([
      ["Health", 2],
      ["Fitness", 1],
      ["Parenting", 0],
    ]);
  });
});

describe("deleting", () => {
  const overviews = [{ topicIds: [health.id] }, { topicIds: [health.id, fitness.id] }, { topicIds: [fitness.id] }, { topicIds: [] }];

  it("counts what the topics are on and what will have no topic left", () => {
    expect(filedUnderAny(overviews, [health.id])).toBe(2);
    expect(leftWithoutTopic(overviews, [health.id])).toBe(1);
    expect(leftWithoutTopic(overviews, [health.id, fitness.id])).toBe(3);
  });

  it("asks about one topic in the design's words", () => {
    expect(deleteCopy([parenting], 3, 2)).toEqual({
      title: "Delete Parenting?",
      names: null,
      body: "It’s on 3 overviews. They stay in your library; 2 will have no topic.",
      button: "Delete topic",
    });
  });

  it("names several topics and counts them together", () => {
    expect(deleteCopy([parenting, health, fitness], 10, 4)).toEqual({
      title: "Delete 3 topics?",
      names: "Parenting, Health and Fitness",
      body: "They’re on 10 overviews. Those stay in your library; 4 will have no topic.",
      button: "Delete 3 topics",
    });
  });

  it("says nothing about the library for a topic on no overview, or about unsorted when none will be", () => {
    expect(deleteCopy([parenting], 0, 0).body).toBe("It’s on 0 overviews.");
    expect(deleteCopy([parenting], 1, 0).body).toBe("It’s on 1 overview. It stays in your library.");
  });

  it("says afterwards how many have no topic now", () => {
    expect(deletedNotice([parenting], 2)).toBe("Deleted Parenting. 2 overviews have no topic now.");
    expect(deletedNotice([parenting], 1)).toBe("Deleted Parenting. 1 overview has no topic now.");
    expect(deletedNotice([parenting, health], 0)).toBe("Deleted 2 topics.");
  });
});

describe("renameCheck", () => {
  it("refuses a blank name", () => {
    expect(renameCheck("   ", film, [film])).toEqual({ kind: "blank" });
  });

  it("renames to the trimmed name", () => {
    expect(renameCheck(" Documentaries ", film, [film])).toEqual({ kind: "rename", name: "Documentaries" });
  });

  it("is a merge onto a name another topic has, ignoring case and spaces", () => {
    expect(renameCheck("parenting ", fitness, [fitness, parenting])).toEqual({ kind: "merge", into: parenting });
  });

  it("is a rename when only the topic's own case changes", () => {
    expect(renameCheck("film", film, [film])).toEqual({ kind: "rename", name: "film" });
  });
});

describe("the description after a rename", () => {
  it("asks for a look when the name moved and the description was left as it was", () => {
    expect(descriptionNeedsLook(film, "Documentaries", "Films, including TV.")).toBe(true);
  });

  it("stops asking once the description is edited or cleared, and never asks with none or the same name", () => {
    expect(descriptionNeedsLook(film, "Documentaries", "Documentaries.")).toBe(false);
    expect(descriptionNeedsLook(film, "Documentaries", "")).toBe(false);
    expect(descriptionNeedsLook(film, "Film", "Films, including TV.")).toBe(false);
    expect(descriptionNeedsLook(parenting, "Fatherhood", "")).toBe(false);
  });

  it("says what happened to it, for the event", () => {
    expect(descriptionChange(film, "Films, including TV.")).toBe("left");
    expect(descriptionChange(film, null)).toBe("cleared");
    expect(descriptionChange(film, "Documentaries.")).toBe("changed");
  });
});

describe("merging", () => {
  const picked = [
    { topic: health, count: 24 },
    { topic: fitness, count: 9 },
  ];

  it("keeps the most used topic and its own description by default, offering the others to borrow", () => {
    const defaults = mergeDefaults(picked);

    expect(defaults.keep).toBe(health.id);
    expect(defaults.description).toBe("Wellbeing, illness and medical care.");
    expect(borrowNote(defaults)).toBe("From Health. Fitness had “Exercise, training and sport.”");
  });

  it("takes the first merged description when the kept topic has none", () => {
    const defaults = mergeDefaults([
      { topic: parenting, count: 12 },
      { topic: fitness, count: 3 },
    ]);

    expect(defaults.description).toBe("Exercise, training and sport.");
    expect(borrowNote(defaults)).toBeNull();
  });

  it("aims at a picked topic, an existing one by name, or a new name", () => {
    const picks = [health, fitness];

    expect(mergeTarget(fitness.id, "", picks, [health, fitness, parenting])).toEqual({ kind: "picked", topic: fitness });
    expect(mergeTarget("new", " fitness", picks, [health, fitness, parenting])).toEqual({ kind: "picked", topic: fitness });
    expect(mergeTarget("new", "parenting", picks, [health, fitness, parenting])).toEqual({ kind: "existing", topic: parenting });
    expect(mergeTarget("new", "Health & fitness", picks, [health, fitness, parenting])).toEqual({ kind: "new", name: "Health & fitness" });
    expect(mergeTarget("new", "  ", picks, [health, fitness])).toBeNull();
  });

  it("says where the topic now is", () => {
    expect(mergedNotice(3, "Parenting", 17)).toBe("Merged 3 topics into Parenting, now on 17 overviews.");
  });
});

it("sums the library up under the heading", () => {
  expect(summaryLine(14, 239)).toBe("14 topics on 239 overviews. Changes apply to every overview filed under the topic.");
  expect(summaryLine(1, 4)).toBe("1 topic on 4 overviews. Changes apply to every overview filed under the topic.");
});
