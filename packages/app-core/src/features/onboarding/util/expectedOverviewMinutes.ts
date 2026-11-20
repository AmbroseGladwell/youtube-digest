import { READING_WORDS_PER_MINUTE, SPOKEN_WORDS_PER_MINUTE, type Source } from "@overview/domain";
import { noteBudget } from "@overview/generation";

// Premise, core claim, verdict and How to apply, beside the key points and big picture the budget
// sizes. Set from real overviews' word counts (docs/features/onboarding.md, "Your link").
export const FIXED_SECTION_WORDS = 200;

export interface ExpectedMinutes {
  read: number;
  listen: number;
}

// What Your link promises before anything is written: the writer's own budget for a source this
// long, at the reader's own reading and speaking rates. Arithmetic, never a model's guess; null
// where the source's length isn't known.
export function expectedOverviewMinutes(source: Source): ExpectedMinutes | null {
  const sourceWords =
    source.kind === "web"
      ? source.wordCount
      : source.durationMs === null
        ? null
        : Math.round((source.durationMs / 60_000) * SPOKEN_WORDS_PER_MINUTE);
  if (sourceWords === null || sourceWords <= 0) return null;
  const budget = noteBudget(source.kind === "web" ? "written" : "spoken", sourceWords);
  const words = budget.keyPoints * budget.wordsPerKeyPoint + budget.bigPictureWords + FIXED_SECTION_WORDS;
  return {
    read: Math.max(1, Math.round(words / READING_WORDS_PER_MINUTE)),
    listen: Math.max(1, Math.round(words / SPOKEN_WORDS_PER_MINUTE)),
  };
}
