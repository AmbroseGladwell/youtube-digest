import type { RunReport } from "@overview/app-core";
import { IDLE_BUTTON_STATE, type ButtonState } from "./overviewBridge.js";

export interface ButtonFacts {
  videoId: string;
  report: RunReport | null;
  // null is not false: docs/features/injected-button.md, "Four states, and where each one's facts come from".
  held: boolean | null;
}

// The panel follows the tab in front of it, and two tabs can each have a button.
export const overviewButtonState = ({ videoId, report, held }: ButtonFacts): ButtonState => {
  const mine = report !== null && report.videoId === videoId;

  if (mine && report.status === "running") {
    return {
      kind: "generating",
      startedAt: report.startedAt,
      progressFraction: report.progressFraction,
    };
  }

  // A wrong "ready" costs a click; a wrong invite costs a generation for a note that may exist.
  if ((mine && report.status === "ready") || held !== false) {
    return { kind: "ready", startedAt: null, progressFraction: 1 };
  }

  return IDLE_BUTTON_STATE;
};
