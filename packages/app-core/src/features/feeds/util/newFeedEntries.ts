import type { FollowedFeed, FollowedFeedCheck } from "@overview/domain";
import type { KeyedFeedEntry } from "../types/KeyedFeedEntry.js";

export interface NewFeedEntries {
  fresh: KeyedFeedEntry[];
  seen: string[];
}

// Against what this device has seen, as a playlist is: docs/features/followed-feeds.md, "New entries".
export const newFeedEntries = (
  entries: readonly KeyedFeedEntry[],
  feed: FollowedFeed,
  check: FollowedFeedCheck | null,
  known: ReadonlySet<string>,
): NewFeedEntries => {
  const seenBefore = new Set(check?.seenEntryIds ?? []);
  const isNew = ({ entry }: KeyedFeedEntry) =>
    check === null ? entry.publishedAt !== null && entry.publishedAt > feed.followedAt : !seenBefore.has(entry.id);
  const taken = new Set<string>(known);
  const fresh = entries.filter((keyed) => {
    if (!isNew(keyed) || taken.has(keyed.sourceKey)) {
      return false;
    }
    taken.add(keyed.sourceKey);
    return true;
  });
  return { fresh, seen: entries.map(({ entry }) => entry.id) };
};
