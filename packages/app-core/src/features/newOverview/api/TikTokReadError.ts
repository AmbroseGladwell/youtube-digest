import type { TikTokReadFailure } from "@overview/domain";

// Read for its card, before anything was spent on writing it.
export class TikTokReadError extends Error {
  readonly reason: TikTokReadFailure;

  constructor(reason: TikTokReadFailure) {
    super(`The TikTok could not be read: ${reason}`);
    this.reason = reason;
  }
}

// Found, but TikTok has no captions for it, and a note is written from the words (speech-to-text is slice 5).
export class TikTokNoCaptionsError extends Error {
  constructor() {
    super("The TikTok has no captions");
  }
}
