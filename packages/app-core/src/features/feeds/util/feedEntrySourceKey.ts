import { articleSourceId, podcastSourceId, sourceKey, VideoId, type FeedEntry, type SourceKey } from "@overview/domain";

// The key its overview will have, so an entry already made or kept never arrives again (docs/features/followed-feeds.md).
export const feedEntrySourceKey = async (feedUrl: string, entry: FeedEntry): Promise<SourceKey | null> => {
  switch (entry.kind) {
    case "video":
      return entry.youTubeVideoId === null ? null : VideoId.parse(entry.youTubeVideoId);
    case "episode":
      return sourceKey({ kind: "podcast", id: await podcastSourceId({ feedUrl, guid: entry.id }) });
    case "article":
      return entry.pageUrl === null ? null : sourceKey({ kind: "web", id: await articleSourceId(entry.pageUrl) });
  }
};
