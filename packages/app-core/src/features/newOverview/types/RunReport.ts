import type { OverviewId, VideoId } from "@overview/domain";

// Enough to paint the button's states without handing the page the note itself.
export interface RunReport {
  videoId: VideoId | null;
  videoUrl: string;
  startedAt: number;
  status: "running" | "ready" | "failed";
  progressFraction: number;
  overviewId: OverviewId | null;
}
