import type { NewOverviewRun } from "../../newOverview/types/NewOverviewRun.js";
import { generationRunStatus } from "../../newOverview/util/generationRunStatus.js";

export interface MakingStep {
  step: string;
  progress: number;
}

const stepLabel = (short: boolean, fetching: boolean): string => {
  if (short) {
    return fetching ? "Fetching" : "Writing";
  }
  return fetching ? "Fetching the transcript" : "Writing the overview";
};

// Where the video being made has got to, in the queue's words, and how far along that is,
// counted from the steps that have actually happened (generationRunStatus).
export const makingStep = (run: NewOverviewRun, short: boolean): MakingStep => {
  const fetching = run.transcriptWords === null;
  return {
    step: stepLabel(short, fetching),
    progress: Math.round(generationRunStatus(run).progressFraction * 100),
  };
};
