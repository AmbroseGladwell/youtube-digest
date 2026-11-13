import type { Overview, PodcastPlatform, VideoSource } from "@overview/domain";
import type { ArticleFailure } from "../api/ArticleReadError.js";
import type { RunError } from "./RunError.js";

// What a run of an article knows, which grows from what the tab says to what the page said.
export interface ArticleRun {
  title: string;
  site: string;
  words: number | null;
  // Chrome's box is up (design 77ac).
  asking: boolean;
  // Reached by right-click, on activeTab, so Create may still ask next time (design 77ah).
  oneTimeAccess: boolean;
  fetched: boolean;
  // Known once the page is read, when it turned out to be a recipe (design 144p).
  recipe: { ingredients: number; steps: number } | null;
  regenerating: boolean;
  failure: ArticleFailure | null;
}

// What a run of an episode knows: what our server read before Create was pressed, then
// whether its words were found (design 106g).
export interface PodcastRun {
  show: string;
  title: string;
  platform: PodcastPlatform;
  durationSeconds: number | null;
  imageUrl: string | null;
  words: number | null;
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
  podcast: PodcastRun | null;
  transcriptWords: number | null;
  overview: Overview | null;
  error: RunError | null;
  // The reason as typed so far. It is asked for while the overview is being made, so it
  // is kept here rather than on the form, and copied onto the record when the run lands
  // (docs/features/capture-reason.md).
  captureReason: string;
}
