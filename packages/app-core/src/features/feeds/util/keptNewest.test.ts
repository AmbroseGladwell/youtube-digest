import { describe, expect, it } from "vitest";
import { OverviewId, SourceKey } from "@overview/domain";
import { makeFeedEntry, makeFollowedFeed } from "../types/FeedFactory.testHelper.js";
import type { KeyedFeedEntry } from "../types/KeyedFeedEntry.js";
import { feedEntryCapture } from "./feedEntryCapture.js";
import { keptNewest } from "./keptNewest.js";

const feed = makeFollowedFeed();
const NOW = new Date("2026-11-28T09:00:00.000Z");
const keyed = (id: string, day: number | null): KeyedFeedEntry => ({
  entry: makeFeedEntry(id, day === null ? null : `2026-11-${String(day).padStart(2, "0")}T09:00:00.000Z`),
  sourceKey: SourceKey.parse(id),
  url: `https://show.example/${id}`,
});
let next = 0;
const waiting = (id: string, day: number, overrides = {}) => ({
  ...feedEntryCapture(keyed(id, day), feed, OverviewId.parse(`00000000-0000-4000-8000-${String(next++).padStart(12, "0")}`), NOW),
  ...overrides,
});
const ids = ({ arriving, dropped }: ReturnType<typeof keptNewest>) => ({
  arriving: arriving.map(({ entry }) => entry.id),
  dropped: dropped.map(({ sourceKey }) => sourceKey),
});

describe("a source keeps its newest entries waiting", () => {
  it("takes everything while there's room", () => {
    expect(ids(keptNewest([waiting("old", 1)], [keyed("new", 2)], NOW, 3))).toEqual({ arriving: ["new"], dropped: [] });
  });

  it("drops the oldest waiting entry when a newer one arrives past the cap", () => {
    const result = keptNewest([waiting("one", 1), waiting("two", 2)], [keyed("three", 3)], NOW, 2);
    expect(ids(result)).toEqual({ arriving: ["three"], dropped: ["one"] });
  });

  it("lets an arrival older than everything kept go unwritten, and counts an undated one as arriving now", () => {
    const result = keptNewest([waiting("two", 2), waiting("three", 3)], [keyed("one", 1), keyed("undated", null)], NOW, 2);
    expect(ids(result)).toEqual({ arriving: ["undated"], dropped: ["two"] });
  });

  it("never drops an entry the reader chose, or one that failed, and doesn't count them", () => {
    const chosen = waiting("chosen", 1, { chosenAt: "2026-11-27T09:00:00.000Z" });
    const failed = waiting("failed", 1, { queueStatus: "failed", problem: "failed" });
    const result = keptNewest([chosen, failed, waiting("two", 2)], [keyed("three", 3)], NOW, 2);
    expect(ids(result)).toEqual({ arriving: ["three"], dropped: [] });
  });
});
