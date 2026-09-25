import type { ReadingPosition } from "../types/ReadingPosition.js";

export const READING_POSITIONS_KEPT = 20;

// Most recent first, one entry per video, and never more than the cap: a reading
// position is a convenience, not a record, and twenty is more transcripts than anyone
// is part-way through (docs/features/reading-position.md).
export function rememberReadingPosition(
  positions: ReadingPosition[],
  videoId: string,
  startMs: number,
): ReadingPosition[] {
  return [{ videoId, startMs }, ...forgetReadingPositionIn(positions, videoId)].slice(
    0,
    READING_POSITIONS_KEPT,
  );
}

export function forgetReadingPositionIn(
  positions: ReadingPosition[],
  videoId: string,
): ReadingPosition[] {
  return positions.filter((position) => position.videoId !== videoId);
}

export function readingPositionFor(positions: ReadingPosition[], videoId: string): number | null {
  return positions.find((position) => position.videoId === videoId)?.startMs ?? null;
}
