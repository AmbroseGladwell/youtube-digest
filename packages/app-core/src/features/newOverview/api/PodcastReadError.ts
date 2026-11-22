import type { PodcastReadFailure } from "@overview/domain";

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

// `transcribable` where our server would transcribe it, if the reader chooses.
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
