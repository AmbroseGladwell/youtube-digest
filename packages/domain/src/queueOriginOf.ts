import type { QueuedCapture } from "./QueuedCapture.js";

export interface QueueOrigin {
  id: string;
  title: string;
}

// The source an entry waits under, a playlist or a feed: docs/features/followed-feeds.md, "One queue".
export const queueOriginOf = ({ fromPlaylist, fromFeed }: Pick<QueuedCapture, "fromPlaylist" | "fromFeed">): QueueOrigin => {
  if (fromPlaylist !== null) {
    return fromPlaylist;
  }
  return { id: fromFeed?.id ?? "", title: fromFeed?.title ?? "" };
};
