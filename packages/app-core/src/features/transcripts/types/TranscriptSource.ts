import type { StoredTranscript, TranscriptSegment, VideoId, VideoSource } from "@overview/domain";

export type TranscriptTier = "shared-cache" | "extension" | "service";

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
  // null falls through to the next rung; so does a throw, kept as the failure the reader is told.
  resolve: (url: string, context: TranscriptSourceContext) => Promise<ResolvedVideo | null>;
}
