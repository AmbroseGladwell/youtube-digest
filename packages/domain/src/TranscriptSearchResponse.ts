import { z } from "zod";

export const TranscriptMoment = z.object({
  startMs: z.number().int().nonnegative(),
  text: z.string(),
  marks: z.array(z.object({ start: z.number().int().nonnegative(), end: z.number().int().nonnegative() })),
});
export type TranscriptMoment = z.infer<typeof TranscriptMoment>;

// Most mentions first: docs/features/transcript-search.md, "The route".
export const TranscriptSearchResponse = z.object({
  matches: z.array(
    z.object({
      overviewId: z.string(),
      mentions: z.number().int().positive(),
      moments: z.array(TranscriptMoment).min(1),
    }),
  ),
});
export type TranscriptSearchResponse = z.infer<typeof TranscriptSearchResponse>;
