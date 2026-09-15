import { z } from "zod";

const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

export const VideoSource = z.object({
  url: z.string().url(),
  title: z.string(),
  channel: z.string(),
  description: z.string().max(400).nullable(),
  // null only for notes generated before docs/v1-architecture-decisions.md's Supadata pin.
  durationMs: z.number().int().positive().nullable(),
});
export type VideoSource = z.infer<typeof VideoSource>;

export const CoreFields = z.object({
  inOneLine: z
    .string()
    .refine((s) => wordCount(s) <= 25, "docs/note-generation-decisions.md: max 25 words"),
  coreClaim: z
    .string()
    .refine((s) => wordCount(s) <= 60, "docs/note-generation-decisions.md: max 60 words"),
  // Gates Verdict — see note.ts's cross-field check and docs/note-generation-decisions.md.
  thin: z.boolean(),
  keyPoints: z.array(z.string()).min(3).max(5),
});
export type CoreFields = z.infer<typeof CoreFields>;
