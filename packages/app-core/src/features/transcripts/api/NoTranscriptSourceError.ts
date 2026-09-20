import type { TranscriptTier } from "../types/TranscriptSource.js";

export type TranscriptSourceOutcome = "unavailable" | "no-answer" | "failed";

export interface TranscriptSourceFailure {
  tier: TranscriptTier;
  outcome: TranscriptSourceOutcome;
  error?: unknown;
}

export class NoTranscriptSourceError extends Error {
  readonly failures: TranscriptSourceFailure[];

  constructor(message: string, failures: TranscriptSourceFailure[]) {
    super(message);
    this.failures = failures;
  }
}
