import type { Overview, PodcastPlatform, VideoSource } from "@overview/domain";
import type { EpisodeTranscription } from "../../podcasts/types/EpisodeTranscription.js";
import type { ArticleFailure } from "../api/ArticleReadError.js";
import type { RunError } from "./RunError.js";

export interface ArticleRun {
  title: string;
  site: string;
  words: number | null;
  // Chrome's permission box is up.
  asking: boolean;
  // Reached by right-click, on activeTab, so Create may still ask next time.
  oneTimeAccess: boolean;
  fetched: boolean;
  recipe: { ingredients: number; steps: number } | null;
  regenerating: boolean;
  failure: ArticleFailure | null;
}

export interface PodcastRun {
  show: string;
  title: string;
  platform: PodcastPlatform;
  durationSeconds: number | null;
  imageUrl: string | null;
  words: number | null;
  transcription: EpisodeTranscription | null;
}

// It outlives the dialog: docs/features/overview-redesign.md, "Generating in the background".
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
  // Kept on the run, not the form: docs/features/capture-reason.md, "Where it is written".
  captureReason: string;
}
