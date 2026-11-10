import type { Overview } from "@overview/domain";
import { noteBudget } from "@overview/generation";

export interface NoteBudgetProps {
  sourceWords: number | undefined;
  keyPoints: number | undefined;
  keyPointCeiling: number | undefined;
  chapters: number | undefined;
}

const UNBUDGETED: NoteBudgetProps = { sourceWords: undefined, keyPoints: undefined, keyPointCeiling: undefined, chapters: undefined };

// Counts only, so the budget's dials can be read against real notes. A recipe page has no key
// points and is on no budget (docs/features/overview-generation-decisions.md, "One note budget").
export function noteBudgetProps(overview: Overview, sourceWords: number | null): NoteBudgetProps {
  if (sourceWords === null || overview.keyPoints.length === 0) {
    return UNBUDGETED;
  }
  return {
    sourceWords,
    keyPoints: overview.keyPoints.length,
    keyPointCeiling: noteBudget(overview.article === null ? "spoken" : "written", sourceWords).keyPoints,
    chapters: (overview.article?.chapters ?? overview.chapters)?.length ?? 0,
  };
}
