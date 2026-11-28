import type { QueuedCapture } from "@overview/domain";
import { isYouTubeUrl } from "../../newOverview/util/parseYouTubeUrl.js";

export type QueuedKind = "video" | "episode" | "article";

// A playlist's are always videos; a feed's are each their own kind (docs/features/followed-feeds.md, "Making an entry").
export const queuedKindOf = (capture: Pick<QueuedCapture, "source" | "url">): QueuedKind => {
  if (capture.source?.kind === "podcast") {
    return "episode";
  }
  return isYouTubeUrl(capture.url) ? "video" : "article";
};
