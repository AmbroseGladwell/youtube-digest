import { z } from "zod";

// Where a reader had got to in a transcript, as the start of the block that was in the
// middle of the window: a time rather than a scroll offset, so it survives the panel and
// the wide reader laying the same blocks out at different heights
// (docs/features/reading-position.md).
export const ReadingPosition = z.object({
  videoId: z.string(),
  startMs: z.number().int().nonnegative(),
});
export type ReadingPosition = z.infer<typeof ReadingPosition>;

export const ReadingPositions = z.array(ReadingPosition);
export type ReadingPositions = z.infer<typeof ReadingPositions>;
