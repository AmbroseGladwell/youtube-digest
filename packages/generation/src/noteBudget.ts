import { MOST_KEY_POINTS } from "@overview/domain";
import { bigPictureBudget } from "./bigPictureBudget.js";

export type SourceForm = "spoken" | "written";

export interface NoteBudget {
  keyPoints: number;
  wordsPerKeyPoint: number;
  mostChapters: number;
  long: boolean;
  bigPictureWords: number;
}

type Rows = ReadonlyArray<readonly [upToWords: number, budget: Omit<NoteBudget, "bigPictureWords">]>;

const LONG = 6000;

const LONG_ROWS: Rows = [
  [12000, { keyPoints: 8, wordsPerKeyPoint: 50, mostChapters: 14, long: true }],
  [Number.POSITIVE_INFINITY, { keyPoints: MOST_KEY_POINTS, wordsPerKeyPoint: 60, mostChapters: 20, long: true }],
];

const ROWS: Record<SourceForm, Rows> = {
  spoken: [[LONG, { keyPoints: 7, wordsPerKeyPoint: 40, mostChapters: 10, long: false }], ...LONG_ROWS],
  written: [
    [400, { keyPoints: 3, wordsPerKeyPoint: 25, mostChapters: 1, long: false }],
    [1000, { keyPoints: 4, wordsPerKeyPoint: 30, mostChapters: 3, long: false }],
    [2500, { keyPoints: 5, wordsPerKeyPoint: 40, mostChapters: 5, long: false }],
    [LONG, { keyPoints: 6, wordsPerKeyPoint: 40, mostChapters: 7, long: false }],
    ...LONG_ROWS,
  ],
};

export const LEAST_KEY_POINTS = 3;

const ROOM_OVER_THE_TARGET = 1.25;
const FINAL_STRETCH = 2 / 3;
const CHAPTER_TOO_BIG_TO_SKIP = 0.25;

// Sized from the source's measured length. Each form keeps its own rows up to 6,000 words,
// and beyond that every source shares the same long rows (docs/features/overview-generation-decisions.md,
// "One note budget").
export const noteBudget = (form: SourceForm, sourceWords: number): NoteBudget => ({
  ...ROWS[form].find(([upToWords]) => sourceWords <= upToWords)![1],
  bigPictureWords: bigPictureBudget(sourceWords),
});

// About two points in five carry a quotation, about four on a deep note: proof points, not a
// template (docs/architecture/overview-quality.md, "How much evidence, and how long").
export const mostQuotations = ({ keyPoints }: NoteBudget): number => Math.max(1, Math.round(keyPoints * 0.4));

export const mostWordsPerKeyPoint = ({ wordsPerKeyPoint }: NoteBudget): number => Math.ceil(wordsPerKeyPoint * ROOM_OVER_THE_TARGET);

// Positions are paragraphs for written sources and transcript segments for spoken ones.
export function positionsInTheFinalStretch(positionWords: readonly number[]): ReadonlySet<number> {
  const total = positionWords.reduce((sum, words) => sum + words, 0);
  const final = new Set<number>();
  let before = 0;
  positionWords.forEach((words, index) => {
    if (before >= total * FINAL_STRETCH) final.add(index);
    before += words;
  });
  return final;
}

// Returns positions in chapterStarts.
export function chaptersTooBigToSkip(positionWords: readonly number[], chapterStarts: readonly number[]): number[] {
  const total = positionWords.reduce((sum, words) => sum + words, 0);
  return chapterStarts.flatMap((start, index) => {
    const end = chapterStarts[index + 1] ?? positionWords.length;
    const words = positionWords.slice(start, end).reduce((sum, count) => sum + count, 0);
    return words / total > CHAPTER_TOO_BIG_TO_SKIP ? [index] : [];
  });
}
