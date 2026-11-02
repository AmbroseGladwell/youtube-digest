import type { Overview, VideoSource } from "@overview/domain";
import type { ArticleFailure } from "../api/ArticleReadError.js";

// What a run of an article knows, which grows from what the tab says to what the page said.
export interface ArticleRun {
  title: string;
  site: string;
  words: number | null;
  // Chrome's box is up (design 77ac).
  asking: boolean;
  // Reached by right-click, on activeTab, so Create may still ask next time (design 77ah).
  oneTimeAccess: boolean;
  regenerating: boolean;
  failure: ArticleFailure | null;
}

// One generation, from the moment Generate is pressed until it is dismissed. It outlives
// the dialog: closing the dialog leaves the run going and hands it to the status strip
// (docs/features/overview-redesign.md, "Generating in the background").
export interface NewOverviewRun {
  url: string;
  startedAt: number;
  finishedAt: number | null;
  video: VideoSource | null;
  article: ArticleRun | null;
  transcriptWords: number | null;
  overview: Overview | null;
  error: string | null;
  // The reason as typed so far. It is asked for while the overview is being made, so it
  // is kept here rather than on the form, and copied onto the record when the run lands
  // (docs/features/capture-reason.md).
  captureReason: string;
}
