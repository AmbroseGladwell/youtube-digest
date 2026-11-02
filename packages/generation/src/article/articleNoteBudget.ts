export interface ArticleNoteBudget {
  keyPoints: number;
  wordsPerKeyPoint: number;
  mostChapters: number;
}

const BUDGETS: ReadonlyArray<readonly [upToWords: number, budget: ArticleNoteBudget]> = [
  [400, { keyPoints: 3, wordsPerKeyPoint: 25, mostChapters: 1 }],
  [1000, { keyPoints: 4, wordsPerKeyPoint: 30, mostChapters: 3 }],
  [2500, { keyPoints: 5, wordsPerKeyPoint: 40, mostChapters: 5 }],
  [6000, { keyPoints: 6, wordsPerKeyPoint: 40, mostChapters: 7 }],
  [Number.POSITIVE_INFINITY, { keyPoints: 7, wordsPerKeyPoint: 40, mostChapters: 10 }],
];

const ROOM_OVER_THE_TARGET = 1.25;
const FINAL_STRETCH = 2 / 3;
const CHAPTER_TOO_BIG_TO_SKIP = 0.25;

// Sized from the measured word count, so a short piece can't come back nearly as long as
// itself and a long one has room to reach its end (docs/features/article-notes.md).
export const articleNoteBudget = (wordCount: number): ArticleNoteBudget =>
  BUDGETS.find(([upToWords]) => wordCount <= upToWords)![1];

// At every length: a short piece with one chapter has only this to hold it to its end.
export function paragraphsInTheFinalStretch(paragraphWords: readonly number[]): ReadonlySet<number> {
  const total = paragraphWords.reduce((sum, words) => sum + words, 0);
  const final = new Set<number>();
  let before = 0;
  paragraphWords.forEach((words, index) => {
    if (before >= total * FINAL_STRETCH) final.add(index);
    before += words;
  });
  return final;
}

// A chapter holding this much of the piece is too much to leave out of the key points, at
// any length. Returns positions in chapterStarts.
export function chaptersTooBigToSkip(paragraphWords: readonly number[], chapterStarts: readonly number[]): number[] {
  const total = paragraphWords.reduce((sum, words) => sum + words, 0);
  return chapterStarts.flatMap((start, index) => {
    const end = chapterStarts[index + 1] ?? paragraphWords.length;
    const words = paragraphWords.slice(start, end).reduce((sum, count) => sum + count, 0);
    return words / total > CHAPTER_TOO_BIG_TO_SKIP ? [index] : [];
  });
}

export const mostWordsPerKeyPoint = ({ wordsPerKeyPoint }: ArticleNoteBudget): number =>
  Math.ceil(wordsPerKeyPoint * ROOM_OVER_THE_TARGET);
