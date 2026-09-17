import type { WatchAnswer } from "@overview/types";

export const WATCH_ANYWAY_LABEL: Record<WatchAnswer, string> = {
  yes: "Worth watching anyway",
  no: "Skip the video, the overview covers it",
  partial: "Worth watching one part",
};
