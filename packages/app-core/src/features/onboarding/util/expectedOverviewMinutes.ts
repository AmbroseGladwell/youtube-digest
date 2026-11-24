import { isWrittenSource, READING_WORDS_PER_MINUTE, SPOKEN_WORDS_PER_MINUTE, type Source } from "@overview/domain";
import { noteBudget } from "@overview/generation";

// How this was measured: docs/features/onboarding.md, "The flow on the web".
export const FIXED_SECTION_WORDS = 370;

export interface ExpectedMinutes {
  read: number;
  listen: number;
}

const sourceWordsOf = (source: Source): number | null => {
  if (isWrittenSource(source)) {
    return source.wordCount;
  }
  return source.durationMs === null ? null : Math.round((source.durationMs / 60_000) * SPOKEN_WORDS_PER_MINUTE);
};

export const expectedOverviewMinutes = (source: Source): ExpectedMinutes | null => {
  const sourceWords = sourceWordsOf(source);
  if (sourceWords === null || sourceWords <= 0) {
    return null;
  }
  const budget = noteBudget(isWrittenSource(source) ? "written" : "spoken", sourceWords);
  const words = budget.keyPoints * budget.wordsPerKeyPoint + budget.bigPictureWords + FIXED_SECTION_WORDS;
  return {
    read: Math.max(1, Math.round(words / READING_WORDS_PER_MINUTE)),
    listen: Math.max(1, Math.round(words / SPOKEN_WORDS_PER_MINUTE)),
  };
};
