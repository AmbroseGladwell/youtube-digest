import type { TranscriptionFailure } from "@overview/domain";

// Counts nothing; `no-audio` is a feed that offered no audio to transcribe.
export class TranscriptionFailedError extends Error {
  readonly reason: TranscriptionFailure | "no-audio";

  constructor(reason: TranscriptionFailure | "no-audio") {
    super(`The episode couldn't be transcribed: ${reason}`);
    this.name = "TranscriptionFailedError";
    this.reason = reason;
  }
}
