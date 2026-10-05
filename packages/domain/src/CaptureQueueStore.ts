import type { PlaylistId, VideoId } from "./Brands.js";
import type { QueuedCapture } from "./QueuedCapture.js";

export interface CaptureQueueStore {
  // Oldest queued first, which is the order they are made in (docs/features/capture-queue.md).
  listQueue(): Promise<QueuedCapture[]>;
  // A video already in the queue keeps its place rather than being queued twice.
  enqueue(captures: QueuedCapture[]): Promise<void>;
  saveQueued(capture: QueuedCapture): Promise<void>;
  removeQueued(videoId: VideoId): Promise<void>;
  // Only what is still waiting: a problem stays until the reader dismisses it.
  removeWaiting(fromPlaylist?: PlaylistId): Promise<void>;
}
