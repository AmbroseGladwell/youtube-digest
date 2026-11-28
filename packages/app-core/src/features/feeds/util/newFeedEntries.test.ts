import { describe, expect, it } from "vitest";
import { SourceKey } from "@overview/domain";
import { makeFeedEntry, makeFollowedFeed } from "../types/FeedFactory.testHelper.js";
import type { KeyedFeedEntry } from "../types/KeyedFeedEntry.js";
import { newFeedEntries } from "./newFeedEntries.js";

const feed = makeFollowedFeed({ followedAt: "2026-11-20T09:00:00.000Z" });
const keyed = (id: string, publishedAt: string | null, key = id): KeyedFeedEntry => ({
  entry: makeFeedEntry(id, publishedAt),
  sourceKey: SourceKey.parse(key),
  url: `https://show.example/${id}`,
});
const entries = [keyed("c", "2026-11-27T09:00:00.000Z"), keyed("b", "2026-11-21T09:00:00.000Z"), keyed("a", "2026-11-10T09:00:00.000Z")];
const check = (seen: string[]) => ({ feedId: feed.id, seenEntryIds: seen, checkedAt: "2026-11-25T09:00:00.000Z" });
const ids = (result: ReturnType<typeof newFeedEntries>) => result.fresh.map(({ entry }) => entry.id);

describe("which of a feed's entries are new on this device", () => {
  it("is what this device hasn't seen, and every entry is seen afterwards", () => {
    const result = newFeedEntries(entries, feed, check(["b", "a"]), new Set());
    expect(ids(result)).toEqual(["c"]);
    expect(result.seen).toEqual(["c", "b", "a"]);
  });

  it("on a device that has never checked, is what came out after the feed was followed", () => {
    expect(ids(newFeedEntries([...entries, keyed("undated", null)], feed, null, new Set()))).toEqual(["c", "b"]);
  });

  it("leaves out an entry already in the library or the queue, and one the feed lists twice", () => {
    const twice = [...entries, keyed("c-again", "2026-11-27T10:00:00.000Z", "c")];
    expect(ids(newFeedEntries(twice, feed, check([]), new Set(["b"])))).toEqual(["c", "a"]);
  });
});
