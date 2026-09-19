import { z } from "zod";
import { VideoId } from "./Brands.js";
import { TranscriptSegment } from "./TranscriptSegment.js";
import { VideoSource } from "./VideoSource.js";

export const StoredTranscript = z.object({
  videoId: VideoId,
  segments: z.array(TranscriptSegment),
  // false for YouTube's own caption track, true for the ASR fallback — the reader says
  // which it is rather than presenting machine-heard text as the video's own words.
  generated: z.boolean(),
  fetchedAt: z.iso.datetime(),
  // The metadata call that resolved this video, kept beside the captions it was fetched
  // with (docs/features/watching-detection.md). Optional rather than nullable: records
  // written before this existed have no such key, and a missing block is a cache miss
  // that costs one call to fill, not a state to migrate.
  video: VideoSource.optional(),
});
export type StoredTranscript = z.infer<typeof StoredTranscript>;
