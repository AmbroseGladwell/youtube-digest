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

// The episode was found, but no words for it were, so nothing could be written (design 106h);
// `transcribable` where our server would transcribe it, if the reader chooses (design 305c-2).
export class PodcastNoTranscriptError extends Error {
  readonly transcribable: boolean;
  readonly episodeSeconds: number | null;

  constructor(transcribable = false, episodeSeconds: number | null = null) {
    super("There's no transcript for this episode yet");
    this.name = "PodcastNoTranscriptError";
    this.transcribable = transcribable;
    this.episodeSeconds = episodeSeconds;
  }
}
