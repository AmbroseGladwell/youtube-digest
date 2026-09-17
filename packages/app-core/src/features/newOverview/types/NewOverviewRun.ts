import type { Overview, VideoSource } from "@overview/types";

// One generation, from the moment Generate is pressed until it is dismissed. It outlives
// the dialog: closing the dialog leaves the run going and hands it to the status strip
// (docs/features/overview-redesign.md, "Generating in the background").
export interface NewOverviewRun {
  url: string;
  startedAt: number;
  finishedAt: number | null;
  video: VideoSource | null;
  transcriptWords: number | null;
  overview: Overview | null;
  error: string | null;
}
