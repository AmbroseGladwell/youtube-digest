import type { TranscriptSegment } from "@overview/domain";

export interface FetchedCaptions {
  transcript: TranscriptSegment[];
  // false for the platform's own caption track, true for machine transcription. What a
  // given source can actually tell about this differs by source
  // (docs/features/transcript-retrieval.md, "What generated means").
  generated: boolean;
}
