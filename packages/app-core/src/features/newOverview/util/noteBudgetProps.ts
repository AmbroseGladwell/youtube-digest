import type { Overview } from "@overview/domain";
import { noteBudget } from "@overview/generation";

export interface NoteBudgetProps {
  sourceWords: number | undefined;
  keyPoints: number | undefined;
  keyPointCeiling: number | undefined;
  chapters: number | undefined;
}

const UNBUDGETED: NoteBudgetProps = { sourceWords: undefined, keyPoints: undefined, keyPointCeiling: undefined, chapters: undefined };

// A recipe page is on no budget: docs/features/overview-generation-decisions.md, "One note budget".
export const noteBudgetProps = (overview: Overview, sourceWords: number | null, headedParts = 0): NoteBudgetProps => {
  if (sourceWords === null || overview.keyPoints.length === 0) {
    return UNBUDGETED;
  }
  return {
    sourceWords,
    keyPoints: overview.keyPoints.length,
    keyPointCeiling: noteBudget(overview.article === null ? "spoken" : "written", sourceWords, headedParts).keyPoints,
    chapters: (overview.article?.chapters ?? overview.chapters)?.length ?? 0,
  };
};
