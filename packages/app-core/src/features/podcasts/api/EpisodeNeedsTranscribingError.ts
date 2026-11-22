import { TranscriptFetchError, TranscriptFetchFailure } from "@overview/transcripts";

// Still no captions to everything that counts failures; the run asks the reader before anything is spent.
export class EpisodeNeedsTranscribingError extends TranscriptFetchError {
  constructor(cause: TranscriptFetchError) {
    super(cause.message, {
      failure: TranscriptFetchFailure.NO_CAPTIONS,
      cause,
      ...(cause.sourceId === null ? {} : { sourceId: cause.sourceId }),
    });
    this.name = "EpisodeNeedsTranscribingError";
  }
}
