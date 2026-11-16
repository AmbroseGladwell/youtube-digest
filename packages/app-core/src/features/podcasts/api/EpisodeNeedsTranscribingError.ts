import { TranscriptFetchError, TranscriptFetchFailure } from "@overview/transcripts";

// No rung found the episode's words after Create, where our server would transcribe it for this
// reader: the check before Create couldn't tell, or was wrong (design 305c-2). Still no captions to
// everything that counts failures; the run asks the reader before anything is spent.
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
