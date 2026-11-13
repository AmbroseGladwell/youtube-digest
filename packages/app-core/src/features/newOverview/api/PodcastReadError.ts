import type { PodcastReadFailure } from "@overview/domain";

// Our server read the link and said why it isn't an episode we can use (designs 106d–106f).
export class PodcastReadError extends Error {
  readonly reason: PodcastReadFailure;
  readonly showName: string | null;

  constructor(reason: PodcastReadFailure, showName: string | null) {
    super(`The podcast link couldn't be read: ${reason}`);
    this.name = "PodcastReadError";
    this.reason = reason;
    this.showName = showName;
  }
}

// The episode was found, but no words for it were, so nothing could be written (design 106h).
export class PodcastNoTranscriptError extends Error {
  constructor() {
    super("There's no transcript for this episode yet");
    this.name = "PodcastNoTranscriptError";
  }
}
