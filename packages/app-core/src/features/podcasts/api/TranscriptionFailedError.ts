import type { TranscribedSource, TranscriptionFailure } from "@overview/domain";

// Counts nothing; `no-audio` is a feed that offered no audio to transcribe.
export class TranscriptionFailedError extends Error {
  readonly reason: TranscriptionFailure | "no-audio";
  readonly source: TranscribedSource;

  constructor(reason: TranscriptionFailure | "no-audio", source: TranscribedSource = "podcast") {
    super(`The ${source === "tiktok" ? "TikTok" : "episode"} couldn't be transcribed: ${reason}`);
    this.name = "TranscriptionFailedError";
    this.reason = reason;
    this.source = source;
  }
}
