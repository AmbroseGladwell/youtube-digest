import type { TranscriptSegment } from "@overview/domain";

export interface FetchedCaptions {
  transcript: TranscriptSegment[];
  // docs/features/transcript-retrieval.md, "What `generated` means, and why it was wrong".
  generated: boolean;
}
