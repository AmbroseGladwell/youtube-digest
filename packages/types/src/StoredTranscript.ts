import { z } from "zod";
import { VideoId } from "./Brands.js";
import { TranscriptSegment } from "./TranscriptSegment.js";

export const StoredTranscript = z.object({
  videoId: VideoId,
  segments: z.array(TranscriptSegment),
  // false for YouTube's own caption track, true for the ASR fallback — the reader says
  // which it is rather than presenting machine-heard text as the video's own words.
  generated: z.boolean(),
  fetchedAt: z.iso.datetime(),
});
export type StoredTranscript = z.infer<typeof StoredTranscript>;
