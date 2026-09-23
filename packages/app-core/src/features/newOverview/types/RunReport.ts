import type { OverviewId, VideoId } from "@overview/domain";

// What the injected YouTube button is told about a run, and no more: enough to paint
// design 18c's generating and ready states without handing the page the note itself
// (docs/features/injected-button.md).
export interface RunReport {
  videoId: VideoId | null;
  videoUrl: string;
  startedAt: number;
  status: "running" | "ready" | "failed";
  progressFraction: number;
  overviewId: OverviewId | null;
}
