import { z } from "zod";
import { VideoId } from "./Brands.js";
import { FeedOrigin } from "./FeedOrigin.js";
import { Source } from "./Source.js";
import { PlaylistOrigin } from "./PlaylistOrigin.js";

// skipped was never tried; failed was tried and couldn't be made (docs/features/capture-queue.md).
export const QueuedCaptureStatus = z.enum(["waiting", "skipped", "failed"]);
export type QueuedCaptureStatus = z.infer<typeof QueuedCaptureStatus>;

export const QueuedCaptureProblem = z.enum(["private", "deleted", "noCaptions", "unavailable", "needsTranscribing", "failed"]);
export type QueuedCaptureProblem = z.infer<typeof QueuedCaptureProblem>;

// The device's own until OV-11 syncs it (docs/features/capture-queue.md).
export const QueuedCapture = z.object({
  videoId: VideoId,
  url: z.url(),
  title: z.string(),
  thumbnailUrl: z.url().nullable(),
  // One or the other: docs/features/followed-feeds.md, "One queue".
  fromPlaylist: PlaylistOrigin.nullable(),
  fromFeed: FeedOrigin.nullish().catch(null),
  // An episode's feed and guid, which a feed's entry is read again by (docs/features/followed-feeds.md).
  source: Source.nullish().catch(null),
  queuedAt: z.iso.datetime(),
  status: QueuedCaptureStatus,
  problem: QueuedCaptureProblem.nullable(),
  // Null unless the reader chose it: docs/features/capture-queue.md, "Making waiting videos now".
  chosenAt: z.iso.datetime().nullable().catch(null),
  // Orders a playlist's waiting videos: docs/features/playlists.md, "An order for each playlist".
  addedAt: z.iso.datetime().nullable().catch(null),
  playlistIndex: z.number().int().nonnegative().nullable().catch(null),
});
export type QueuedCapture = z.infer<typeof QueuedCapture>;
