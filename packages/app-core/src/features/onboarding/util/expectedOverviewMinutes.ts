import { READING_WORDS_PER_MINUTE, SPOKEN_WORDS_PER_MINUTE, type Source } from "@overview/domain";
import { noteBudget } from "@overview/generation";

// Everything an overview's reader reads beside the key points and big picture the budget sizes:
// premise, core claim, How to apply, the steps it gives, the verdict. Measured 20 Nov 2026 over the
// 60 overviews saved since 12 Nov: a median of 374 words beyond the budget, half between 164 and
// 478 (docs/features/onboarding.md, "The flow on the web").
export const FIXED_SECTION_WORDS = 370;

export interface ExpectedMinutes {
  read: number;
  listen: number;
}

// What Your link promises before anything is written: the writer's own budget for a source this
// long, at the reader's own reading and speaking rates. Arithmetic, never a model's guess; null
// where the source's length isn't known.
export const expectedOverviewMinutes = (source: Source): ExpectedMinutes | null => {
  const sourceWords =
    source.kind === "web"
      ? source.wordCount
      : source.durationMs === null
        ? null
        : Math.round((source.durationMs / 60_000) * SPOKEN_WORDS_PER_MINUTE);
  if (sourceWords === null || sourceWords <= 0) {
    return null;
  }
  const budget = noteBudget(source.kind === "web" ? "written" : "spoken", sourceWords);
  const words = budget.keyPoints * budget.wordsPerKeyPoint + budget.bigPictureWords + FIXED_SECTION_WORDS;
  return {
    read: Math.max(1, Math.round(words / READING_WORDS_PER_MINUTE)),
    listen: Math.max(1, Math.round(words / SPOKEN_WORDS_PER_MINUTE)),
  };
};
