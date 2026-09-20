import type { StoredTranscript, TranscriptSegment, VideoId, VideoSource } from "@overview/types";

export type TranscriptTier = "shared-cache" | "extension" | "supadata" | "service";

// Whether reaching this rung can cost the user anything. The background prefetch is handed
// only the free rungs, so "the background never spends" is a property of what it can reach
// rather than a rule to remember (docs/features/transcript-retrieval.md).
export type TranscriptCost = "free" | "metered";

export interface ResolvedVideo {
  video: VideoSource;
  transcript: TranscriptSegment[];
  generated: boolean;
}

export interface TranscriptSourceContext {
  readHeldTranscript: (videoId: VideoId) => Promise<StoredTranscript | null>;
}

export interface TranscriptSource {
  readonly tier: TranscriptTier;
  readonly cost: TranscriptCost;
  // Never spends, and must never hang.
  isReady: () => Promise<boolean>;
  // null means "not here", and falls through to the next rung. A throw falls through too,
  // and is kept so the last real failure is what the reader is told about.
  resolve: (url: string, context: TranscriptSourceContext) => Promise<ResolvedVideo | null>;
}
