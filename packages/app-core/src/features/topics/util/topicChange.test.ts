import { describe, expect, it } from "vitest";
import { OverviewId, TopicId, type Topic } from "@overview/domain";
import { topicIdsAfter, topicsAfter } from "./topicChange.js";

const topic = (name: string, description: string | null = null): Topic => ({
  id: TopicId.parse(crypto.randomUUID()),
  name,
  description,
  createdAt: "2026-11-27T08:00:00.000Z",
});
const overview = OverviewId.parse(crypto.randomUUID());

const health = topic("Health", "Wellbeing.");
const fitness = topic("Fitness");
const other = topic("Food");

describe("topicsAfter", () => {
  it("edits one topic", () => {
    expect(topicsAfter([health, fitness], { kind: "edit", id: fitness.id, patch: { description: "Exercise." } })).toEqual([
      health,
      { ...fitness, description: "Exercise." },
    ]);
  });

  it("drops merged topics and edits the kept one", () => {
    expect(
      topicsAfter([health, fitness, other], { kind: "merge", from: [fitness.id], into: health.id, patch: { name: "Health & fitness" } }),
    ).toEqual([{ ...health, name: "Health & fitness" }, other]);
  });

  it("puts merged topics back on undo, and the kept one as it was", () => {
    const merges = [{ topic: fitness, into: health.id, refiled: [], added: [] }];

    expect(
      topicsAfter([{ ...health, name: "Health & fitness" }], { kind: "undoMerge", merges, into: health.id, restore: { name: "Health" } }),
    ).toEqual([health, fitness]);
  });

  it("drops deleted topics", () => {
    expect(topicsAfter([health, fitness], { kind: "delete", ids: [health.id] })).toEqual([fitness]);
  });
});

describe("topicIdsAfter", () => {
  it("files a merged topic's overviews under the kept one, once", () => {
    expect(
      topicIdsAfter(overview, [health.id, fitness.id, other.id], { kind: "merge", from: [fitness.id], into: health.id, patch: null }),
    ).toEqual([health.id, other.id]);
  });

  it("puts a merge back exactly", () => {
    const merges = [{ topic: fitness, into: health.id, refiled: [overview], added: [overview] }];

    expect(topicIdsAfter(overview, [health.id], { kind: "undoMerge", merges, into: health.id, restore: null })).toEqual([fitness.id]);
  });

  it("unfiles deleted topics", () => {
    expect(topicIdsAfter(overview, [health.id, fitness.id], { kind: "delete", ids: [health.id, fitness.id] })).toEqual([]);
  });
});
