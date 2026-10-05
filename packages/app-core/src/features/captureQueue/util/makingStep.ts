import type { NewOverviewRun } from "../../newOverview/types/NewOverviewRun.js";
import { generationRunStatus } from "../../newOverview/util/generationRunStatus.js";

// Where the video being made has got to, in the queue's words, and how far along that is,
// counted from the steps that have actually happened (generationRunStatus).
export function makingStep(run: NewOverviewRun, short: boolean): { step: string; progress: number } {
  const fetching = run.transcriptWords === null;
  return {
    step: short ? (fetching ? "Fetching" : "Writing") : fetching ? "Fetching the transcript" : "Writing the overview",
    progress: Math.round(generationRunStatus(run).progressFraction * 100),
  };
}
