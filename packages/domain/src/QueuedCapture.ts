import { z } from "zod";
import { VideoId } from "./Brands.js";
import { PlaylistOrigin } from "./PlaylistOrigin.js";

// Waiting is in line to be made. Skipped was never tried: YouTube will not show it, or it
// was already made. Failed was tried and could not be made (docs/features/capture-queue.md).
export const QueuedCaptureStatus = z.enum(["waiting", "skipped", "failed"]);
export type QueuedCaptureStatus = z.infer<typeof QueuedCaptureStatus>;

export const QueuedCaptureProblem = z.enum(["private", "deleted", "noCaptions", "unavailable", "failed"]);
export type QueuedCaptureProblem = z.infer<typeof QueuedCaptureProblem>;

// One video waiting on this device to become an overview. The queue is the device's own
// until OV-11 syncs it (docs/features/capture-queue.md).
export const QueuedCapture = z.object({
  videoId: VideoId,
  url: z.url(),
  title: z.string(),
  thumbnailUrl: z.url().nullable(),
  fromPlaylist: PlaylistOrigin,
  queuedAt: z.iso.datetime(),
  status: QueuedCaptureStatus,
  problem: QueuedCaptureProblem.nullable(),
  // When the reader chose it to be made next, past its playlist's pace. Null for every video
  // the queue makes on its own (docs/features/capture-queue.md, "Making waiting videos now").
  chosenAt: z.iso.datetime().nullable().catch(null),
});
export type QueuedCapture = z.infer<typeof QueuedCapture>;
