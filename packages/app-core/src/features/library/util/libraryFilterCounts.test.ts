import { describe, expect, it } from "vitest";
import { TopicId } from "@overview/domain";
import {
  makeOverviewWithState,
  makeUnreadableEntry,
} from "../../overviews/types/OverviewFactory.testHelper.js";
import { libraryFilterCounts } from "./libraryFilterCounts.js";

const FITNESS = TopicId.parse("11111111-1111-4111-8111-111111111111");
const FINANCE = TopicId.parse("22222222-2222-4222-8222-222222222222");

describe("libraryFilterCounts", () => {
  it("counts the rail's totals from the entries, so no count is ever guessed", () => {
    const counts = libraryFilterCounts([
      makeOverviewWithState(
        {
          topicIds: [FITNESS],
          verdict: { novelty: "novel", dubious: false, reasoning: "x", similarTo: [] },
        },
        { read: true },
      ),
      makeOverviewWithState(
        {
          topicIds: [FITNESS, FINANCE],
          verdict: { novelty: "recycled", dubious: true, reasoning: "x", similarTo: [] },
        },
        { favourite: true },
      ),
      makeOverviewWithState({ thin: true, verdict: null }),
    ]);

    expect(counts).toEqual({
      total: 3,
      unread: 2,
      favourite: 1,
      dubious: 1,
      unreadable: 0,
      byTopic: { [FITNESS]: 2, [FINANCE]: 1 },
      byNovelty: { novel: 1, recycled: 1 },
    });
  });

  // A library that says 28 and holds 30 is the prototype's eleven missing notes with a
  // new address (docs/features/record-migrations.md).
  it("counts a record it cannot read in the total, and says so separately", () => {
    const counts = libraryFilterCounts([
      makeOverviewWithState({ topicIds: [FITNESS] }, { read: true }),
      makeUnreadableEntry(),
    ]);

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
      byTopic: {},
      byNovelty: {},
    });
  });
});
