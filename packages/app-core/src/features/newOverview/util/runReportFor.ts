import type { RunReport } from "../types/RunReport.js";
import type { NewOverviewRun } from "../types/NewOverviewRun.js";
import { generationRunStatus, type GenerationRunStatus } from "./generationRunStatus.js";

const reportStatusOf = (status: GenerationRunStatus): RunReport["status"] => {
  if (status.isFailed) {
    return "failed";
  }
  return status.isReady ? "ready" : "running";
};

// From generationRunStatus, so the button's bar and the strip's are the same measurement.
export const runReportFor = (run: NewOverviewRun): RunReport => {
  const status = generationRunStatus(run);

  return {
    videoId: run.video?.id ?? null,
    videoUrl: run.url,
    startedAt: run.startedAt,
    status: reportStatusOf(status),
    progressFraction: status.progressFraction,
    overviewId: run.overview?.id ?? null,
  };
};
