import type { FeedEntry } from "@overview/domain";
import { canonicalYouTubeUrl } from "../../newOverview/util/parseYouTubeUrl.js";

export const feedEntryUrl = (entry: FeedEntry): string | null => {
  switch (entry.kind) {
    case "video":
      return entry.youTubeVideoId === null ? null : canonicalYouTubeUrl(`https://www.youtube.com/watch?v=${entry.youTubeVideoId}`);
    case "episode":
      return entry.pageUrl ?? entry.audioUrl;
    case "article":
      return entry.pageUrl;
  }
};
