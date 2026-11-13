import type { WatchAnswer } from "./WatchAnyway.js";

export const WATCH_ANYWAY_LABEL: Record<WatchAnswer, string> = {
  yes: "Worth watching anyway",
  no: "Skip the video, the overview covers it",
  partial: "Worth watching one part",
};

// The same answers for an episode, in a podcast's words (docs/features/podcast-notes.md).
export const LISTEN_ANYWAY_LABEL: Record<WatchAnswer, string> = {
  yes: "Worth listening to anyway",
  no: "Skip the episode, the overview covers it",
  partial: "Worth listening to one part",
};
