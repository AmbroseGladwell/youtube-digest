import type { VideoReadFailure } from "@overview/domain";

// The video couldn't be read for its card, before anything was spent on it.
export class VideoReadError extends Error {
  readonly reason: VideoReadFailure;

  constructor(reason: VideoReadFailure) {
    super(`The video could not be read: ${reason}`);
    this.reason = reason;
  }
}
