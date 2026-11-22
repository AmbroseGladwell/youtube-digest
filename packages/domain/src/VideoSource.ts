import { z } from "zod";
import { VideoId } from "./Brands.js";

export const VideoSource = z.object({
  // null only on notes from before transcripts were stored by video id (docs/features/transcript-storage.md).
  id: VideoId.nullable(),
  url: z.url(),
  title: z.string(),
  channel: z.string(),
  description: z.string().max(400).nullable(),
  // For generation alone: docs/features/recipe-notes.md, "Recipe videos".
  fullDescription: z.string().max(5000).optional(),
  // The video's own length, never derived from captions (docs/features/transcript-retrieval.md).
  durationMs: z.number().int().positive().nullable(),
  // As the platform reports it; null where unknown or not a real date.
  publishedAt: z.iso.datetime().nullable(),
  // Resolved by the platform, never guessed from YouTube's img.youtube.com pattern.
  thumbnailUrl: z.url().nullable(),
});
export type VideoSource = z.infer<typeof VideoSource>;
