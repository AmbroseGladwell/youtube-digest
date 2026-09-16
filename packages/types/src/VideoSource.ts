import { z } from "zod";

export const VideoSource = z.object({
  url: z.url(),
  title: z.string(),
  channel: z.string(),
  description: z.string().max(400).nullable(),
  // null only for notes generated before docs/architecture/v1-architecture-decisions.md's Supadata pin.
  durationMs: z.number().int().positive().nullable(),
  // Supadata's own resolved thumbnail (Metadata.media.thumbnailUrl for media.type "video"),
  // never derived by guessing YouTube's img.youtube.com URL pattern. Null for non-video
  // media and for notes generated before this field existed.
  thumbnailUrl: z.url().nullable(),
});
export type VideoSource = z.infer<typeof VideoSource>;
