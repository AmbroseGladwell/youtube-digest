import { z } from "zod";

// A time, not a scroll offset: docs/features/reading-position.md, "What is remembered".
export const ReadingPosition = z.object({
  videoId: z.string(),
  startMs: z.number().int().nonnegative(),
});
export type ReadingPosition = z.infer<typeof ReadingPosition>;

export const ReadingPositions = z.array(ReadingPosition);
export type ReadingPositions = z.infer<typeof ReadingPositions>;
