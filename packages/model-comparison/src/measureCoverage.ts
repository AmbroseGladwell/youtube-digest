export interface PositionSpan {
  start: number;
  end: number;
}

export interface CoverageInput {
  unitWords: readonly number[];
  points: readonly (PositionSpan | null)[];
  chapterStarts: readonly number[];
}

export interface Stretch {
  start: number;
  end: number;
  share: number;
}

export interface Coverage {
  totalWords: number;
  points: number;
  unplaced: number;
  outOfRange: number;
  measurable: boolean;
  spanShare: number | null;
  chapterShare: number | null;
  chaptersReached: number;
  chapters: number;
  largestGap: Stretch | null;
  pointsByThird: [number, number, number];
}

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);

const isInside = (span: PositionSpan, units: number): boolean => span.start >= 0 && span.start <= span.end && span.end < units;

function chapterBounds(chapterStarts: readonly number[], units: number): PositionSpan[] {
  const starts = [...new Set(chapterStarts.filter((start) => start >= 0 && start < units))].sort((a, b) => a - b);
  if (starts.length === 0) return units === 0 ? [] : [{ start: 0, end: units - 1 }];
  return starts.map((start, index) => ({ start: index === 0 ? 0 : start, end: (starts[index + 1] ?? units) - 1 }));
}

function largestUncoveredStretch(unitWords: readonly number[], covered: readonly boolean[], totalWords: number): Stretch | null {
  let best: Stretch | null = null;
  let runStart = -1;
  let runWords = 0;
  for (let index = 0; index <= unitWords.length; index += 1) {
    if (index < unitWords.length && !covered[index]) {
      if (runStart === -1) runStart = index;
      runWords += unitWords[index]!;
      continue;
    }
    if (runStart !== -1 && runWords > 0 && (best === null || runWords / totalWords > best.share)) {
      best = { start: runStart, end: index - 1, share: runWords / totalWords };
    }
    runStart = -1;
    runWords = 0;
  }
  return best;
}

export function measureCoverage({ unitWords, points, chapterStarts }: CoverageInput): Coverage {
  const units = unitWords.length;
  const totalWords = sum(unitWords);
  const placed = points.filter((span): span is PositionSpan => span !== null && isInside(span, units));
  const unplaced = points.filter((span) => span === null).length;
  const outOfRange = points.length - unplaced - placed.length;
  const chapters = chapterBounds(chapterStarts, units);
  const empty = {
    totalWords,
    points: points.length,
    unplaced,
    outOfRange,
    chapters: chapters.length,
  };
  if (placed.length === 0 || totalWords === 0) {
    return {
      ...empty,
      measurable: false,
      spanShare: null,
      chapterShare: null,
      chaptersReached: 0,
      largestGap: null,
      pointsByThird: [0, 0, 0],
    };
  }

  const covered = unitWords.map((_, index) => placed.some((span) => span.start <= index && index <= span.end));
  const wordsCovered = sum(unitWords.filter((_, index) => covered[index]));

  const reached = chapters.filter((chapter) => placed.some((span) => span.start <= chapter.end && span.end >= chapter.start));
  const wordsIn = (span: PositionSpan) => sum(unitWords.slice(span.start, span.end + 1));

  const wordsBefore: number[] = [];
  unitWords.forEach((_, index) => wordsBefore.push(index === 0 ? 0 : wordsBefore[index - 1]! + unitWords[index - 1]!));
  const pointsByThird: [number, number, number] = [0, 0, 0];
  for (const span of placed) {
    const middle = (wordsBefore[span.start]! + wordsBefore[span.end]! + unitWords[span.end]!) / 2;
    const third = Math.min(2, Math.floor((middle / totalWords) * 3)) as 0 | 1 | 2;
    pointsByThird[third] += 1;
  }

  return {
    ...empty,
    measurable: true,
    spanShare: wordsCovered / totalWords,
    chapterShare: sum(reached.map(wordsIn)) / totalWords,
    chaptersReached: reached.length,
    largestGap: largestUncoveredStretch(unitWords, covered, totalWords),
    pointsByThird,
  };
}
