import type { ReadingPosition } from "../types/ReadingPosition.js";

export const READING_POSITIONS_KEPT = 20;

// Why a cap: docs/features/reading-position.md, "Where it lives, and for how long".
export const rememberReadingPosition = (positions: ReadingPosition[], videoId: string, startMs: number): ReadingPosition[] => {
  return [{ videoId, startMs }, ...forgetReadingPositionIn(positions, videoId)].slice(0, READING_POSITIONS_KEPT);
};

export const forgetReadingPositionIn = (positions: ReadingPosition[], videoId: string): ReadingPosition[] => {
  return positions.filter((position) => position.videoId !== videoId);
};

export const readingPositionFor = (positions: ReadingPosition[], videoId: string): number | null => {
  return positions.find((position) => position.videoId === videoId)?.startMs ?? null;
};
