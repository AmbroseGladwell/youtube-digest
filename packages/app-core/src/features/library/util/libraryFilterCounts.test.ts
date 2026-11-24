import { describe, expect, it } from "vitest";
import { TopicId } from "@overview/domain";
import { makeOverviewWithState, makeUnreadableEntry } from "../../overviews/types/OverviewFactory.testHelper.js";
import { libraryFilterCounts } from "./libraryFilterCounts.js";

const FITNESS = TopicId.parse("11111111-1111-4111-8111-111111111111");
const FINANCE = TopicId.parse("22222222-2222-4222-8222-222222222222");

describe("libraryFilterCounts", () => {
  it("counts the rail's totals from the entries, so no count is ever guessed", () => {
    const counts = libraryFilterCounts([
      makeOverviewWithState(
        {
          topicIds: [FITNESS],
          tags: ["saas", "pricing"],
          verdict: {
            novelty: "original",
            standsOut: { text: "A new idea.", range: null },
            dubious: false,
            dubiousClaims: [],
            reasoning: "x",
            similarTo: [],
          },
        },
        { read: true },
      ),
      makeOverviewWithState(
        {
          topicIds: [FITNESS, FINANCE],
          tags: ["saas"],
          verdict: { novelty: "common_knowledge", standsOut: null, dubious: true, dubiousClaims: null, reasoning: "x", similarTo: [] },
        },
        { favourite: true, userTags: ["pricing"] },
      ),
      makeOverviewWithState({ thin: true, verdict: null, tags: [] }),
    ]);

    expect(counts).toEqual({
      total: 3,
      unread: 2,
      favourite: 1,
      dubious: 1,
      unreadable: 0,
      withoutOverview: 0,
      noTopic: 1,
      byTopic: { [FITNESS]: 2, [FINANCE]: 1 },
      byNovelty: { original: 1, common_knowledge: 1 },
      byTag: [
        { tag: "pricing", count: 2 },
        { tag: "saas", count: 2 },
      ],
      byKind: { video: 3 },
      bySource: [{ id: "youtube", name: "YouTube", domain: null, platform: "youtube", count: 3 }],
      byAdded: { any: 3, today: 3, "7d": 3, "30d": 3, "3m": 3, "6m": 3 },
    });
  });

  it("counts a record it cannot read in the total, and says so separately", () => {
    const counts = libraryFilterCounts([makeOverviewWithState({ topicIds: [FITNESS] }, { read: true }), makeUnreadableEntry()]);

    expect(counts.total).toBe(2);
    expect(counts.unreadable).toBe(1);
    expect(counts.unread).toBe(1);
    expect(counts.byTopic).toEqual({ [FITNESS]: 1 });
  });

  it("counts read and favourite for an unreadable record, because that state is readable", () => {
    const counts = libraryFilterCounts([makeUnreadableEntry({}, { read: true, favourite: true })]);

    expect(counts.unread).toBe(0);
    expect(counts.favourite).toBe(1);
  });

  it("returns zeroed counts for an empty library", () => {
    expect(libraryFilterCounts([])).toEqual({
      total: 0,
      unread: 0,
      favourite: 0,
      dubious: 0,
      unreadable: 0,
      withoutOverview: 0,
      noTopic: 0,
      byTopic: {},
      byNovelty: {},
      byTag: [],
      byKind: {},
      bySource: [],
      byAdded: { any: 0, today: 0, "7d": 0, "30d": 0, "3m": 0, "6m": 0 },
    });
  });

  it("counts each Added range from the device's clock, the sources by count, and a recipe under its medium and Recipe", () => {
    const now = new Date(2026, 10, 24, 12, 0);
    const counts = libraryFilterCounts(
      [
        makeOverviewWithState({ savedAt: new Date(2026, 10, 24, 9, 0).toISOString(), recipe: {} as never }),
        makeOverviewWithState({ savedAt: new Date(2026, 9, 1, 9, 0).toISOString() }),
      ],
      now,
    );

    expect(counts.byAdded).toEqual({ any: 2, today: 1, "7d": 1, "30d": 1, "3m": 2, "6m": 2 });
    expect(counts.byKind).toEqual({ video: 2, recipe: 1 });
  });
});
