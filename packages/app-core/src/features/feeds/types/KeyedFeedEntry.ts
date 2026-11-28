import type { FeedEntry, SourceKey } from "@overview/domain";

export interface KeyedFeedEntry {
  entry: FeedEntry;
  sourceKey: SourceKey;
  url: string;
}
