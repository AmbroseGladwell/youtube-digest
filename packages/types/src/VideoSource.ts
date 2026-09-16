import { z } from "zod";

export const VideoSource = z.object({
  url: z.url(),
  title: z.string(),
  channel: z.string(),
  description: z.string().max(400).nullable(),
  // null only for notes generated before docs/architecture/v1-architecture-decisions.md's Supadata pin.
  durationMs: z.number().int().positive().nullable(),
});
export type VideoSource = z.infer<typeof VideoSource>;
