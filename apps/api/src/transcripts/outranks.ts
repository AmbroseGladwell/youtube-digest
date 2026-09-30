import type { StoredTranscript } from "@overview/domain";

const rank = (transcript: StoredTranscript) => (transcript.generated ? 0 : 2) + (transcript.video === undefined ? 0 : 1);

// The first valid copy of a video's transcript is kept, and only a strictly better one
// replaces it: written by a person over machine-heard, then carrying its video's metadata
// over not (docs/features/shared-transcript-cache.md, "First valid copy wins").
export const outranks = (candidate: StoredTranscript, held: StoredTranscript): boolean => rank(candidate) > rank(held);
