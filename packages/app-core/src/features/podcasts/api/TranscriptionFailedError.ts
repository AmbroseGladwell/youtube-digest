import type { TranscriptionFailure } from "@overview/domain";

// A transcription the reader chose that ended without words, which counted nothing (design 305k).
// `no-audio` is a feed that offered none to transcribe.
export class TranscriptionFailedError extends Error {
  readonly reason: TranscriptionFailure | "no-audio";

  constructor(reason: TranscriptionFailure | "no-audio") {
    super(`The episode couldn't be transcribed: ${reason}`);
    this.name = "TranscriptionFailedError";
    this.reason = reason;
  }
}
