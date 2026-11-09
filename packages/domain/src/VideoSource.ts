import { z } from "zod";
import { VideoId } from "./Brands.js";

export const VideoSource = z.object({
  // null only for notes generated before transcripts were stored against a video id
  // (docs/features/transcript-storage.md).
  id: VideoId.nullable(),
  url: z.url(),
  title: z.string(),
  channel: z.string(),
  description: z.string().max(400).nullable(),
  // The whole description, for generation alone: a recipe's ingredients are often past the first
  // 400 characters. Absent where the rung that answered didn't have it, and never on an
  // overview's source (docs/features/recipe-notes.md, "Recipe videos").
  fullDescription: z.string().max(5000).optional(),
  // The video's own length, never the end of its last caption — a caption-derived
  // duration is a measurement, and wrong in both directions
  // (docs/features/transcript-retrieval.md). Null for notes generated before any source
  // supplied one, and for live content.
  durationMs: z.number().int().positive().nullable(),
  // When the video went up, as the platform reports it. Null for notes generated before
  // this field existed, for a value the source sent that isn't a real date, and where the
  // rung that answered carries no publish date at all.
  publishedAt: z.iso.datetime().nullable(),
  // A thumbnail the platform itself resolved, never derived by guessing YouTube's
  // img.youtube.com URL pattern. That rule outlives the source it was written for. Null
  // for non-video media and for notes generated before this field existed.
  thumbnailUrl: z.url().nullable(),
});
export type VideoSource = z.infer<typeof VideoSource>;
