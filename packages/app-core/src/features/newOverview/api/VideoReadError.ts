import type { VideoReadFailure } from "@overview/domain";

// Read for its card, before anything was spent on it.
export class VideoReadError extends Error {
  readonly reason: VideoReadFailure;

  constructor(reason: VideoReadFailure) {
    super(`The video could not be read: ${reason}`);
    this.reason = reason;
  }
}
