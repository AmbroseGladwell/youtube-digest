import type { RunReport } from "../types/RunReport.js";
import type { NewOverviewRun } from "../types/NewOverviewRun.js";
import { generationRunStatus } from "./generationRunStatus.js";

// The status and the fraction come from generationRunStatus rather than being worked out
// again here, so the button's bar and the strip's bar are the same measurement.
export function runReportFor(run: NewOverviewRun): RunReport {
  const status = generationRunStatus(run);

  return {
    videoId: run.video?.id ?? null,
    videoUrl: run.url,
    startedAt: run.startedAt,
    status: status.isFailed ? "failed" : status.isReady ? "ready" : "running",
    progressFraction: status.progressFraction,
    overviewId: run.overview?.id ?? null,
  };
}
