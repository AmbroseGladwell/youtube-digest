import type { WatchAnswer } from "./WatchAnyway.js";

export const WATCH_ANYWAY_LABEL: Record<WatchAnswer, string> = {
  yes: "Worth watching anyway",
  no: "Skip the video, the overview covers it",
  partial: "Worth watching one part",
};
