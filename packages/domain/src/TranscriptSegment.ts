import { z } from "zod";

export const TranscriptSegment = z.object({
  text: z.string(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
});
export type TranscriptSegment = z.infer<typeof TranscriptSegment>;
