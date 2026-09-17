import type { NewOverviewRun } from "../types/NewOverviewRun.js";
import { generationRunSteps } from "./generationRunSteps.js";

export interface GenerationRunStatus {
  label: string;
  step: string;
  progressFraction: number;
  isRunning: boolean;
  isReady: boolean;
  isFailed: boolean;
}

// The one-line version of the progress list, for the status strip. The fraction counts
// finished steps and credits the running one with half of its own, so the rule only ever
// advances on something that actually happened.
export function generationRunStatus(run: NewOverviewRun): GenerationRunStatus {
  const steps = generationRunSteps(run);
  const done = steps.filter((step) => step.state === "done").length;
  const runningIndex = steps.findIndex((step) => step.state === "running");

  if (run.error !== null) {
    return {
      label: "Couldn't create the overview",
      step: `Stopped at step ${done + 1} of ${steps.length}`,
      progressFraction: done / steps.length,
      isRunning: false,
      isReady: false,
      isFailed: true,
    };
  }

  if (run.overview !== null) {
    return {
      label: "Overview ready",
      step: "Done",
      progressFraction: 1,
      isRunning: false,
      isReady: true,
      isFailed: false,
    };
  }

  return {
    label: steps[runningIndex]?.label ?? steps[0]!.label,
    step: `Step ${runningIndex + 1} of ${steps.length}`,
    progressFraction: (done + 0.5) / steps.length,
    isRunning: true,
    isReady: false,
    isFailed: false,
  };
}
