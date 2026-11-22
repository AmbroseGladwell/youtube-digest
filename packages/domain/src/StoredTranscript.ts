import { z } from "zod";
import { VideoId } from "./Brands.js";
import { TranscriptSegment } from "./TranscriptSegment.js";
import { VideoSource } from "./VideoSource.js";

export const StoredTranscript = z.object({
  videoId: VideoId,
  segments: z.array(TranscriptSegment),
  // The reader is told which, rather than shown machine-heard text as the video's words.
  generated: z.boolean(),
  fetchedAt: z.iso.datetime(),
  // Optional: a missing block is a one-call cache miss, not a migration (docs/features/watching-detection.md).
  video: VideoSource.optional(),
});
export type StoredTranscript = z.infer<typeof StoredTranscript>;
