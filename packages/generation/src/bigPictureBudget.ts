import { BIG_PICTURE_MAX_WORDS } from "@overview/domain";

const TARGETS: ReadonlyArray<readonly [upToWords: number, targetWords: number]> = [
  [1000, 0],
  [2500, 35],
  [6000, 60],
  [15000, 90],
  [Number.POSITIVE_INFINITY, 120],
];

const ROOM_OVER_THE_TARGET = 1.25;

// Why it grows with length: docs/features/overview-generation-decisions.md, "The big picture".
export const bigPictureBudget = (sourceWords: number): number => TARGETS.find(([upToWords]) => sourceWords <= upToWords)![1];

export const mostBigPictureWords = (targetWords: number): number =>
  Math.min(Math.ceil(targetWords * ROOM_OVER_THE_TARGET), BIG_PICTURE_MAX_WORDS);
