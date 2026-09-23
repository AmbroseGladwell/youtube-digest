import type { RunReport } from "@overview/app-core";
import { IDLE_BUTTON_STATE, type ButtonState } from "./overviewBridge.js";

export interface ButtonFacts {
  videoId: string;
  report: RunReport | null;
  // Whether the library already holds an overview of this video. Design 18c only draws
  // ready as the end of a run, but a button that said "Overview" for a video already
  // written up would be a one-click way to pay for it twice
  // (docs/features/injected-button.md). null is not false: it is the library failing to
  // answer, and the two cost different things to get wrong
  // (docs/features/record-migrations.md).
  held: boolean | null;
}

// A run for another video is not this button's run: the panel follows the tab you are
// looking at, and two tabs can each have one of these.
export function overviewButtonState({ videoId, report, held }: ButtonFacts): ButtonState {
  const mine = report !== null && report.videoId === videoId;

  if (mine && report.status === "running") {
    return {
      kind: "generating",
      startedAt: report.startedAt,
      progressFraction: report.progressFraction,
    };
  }

  // A failed run says so in the panel, which is where the error is readable. The button
  // goes back to inviting another go rather than carrying a state the design never drew.
  //
  // A library that could not be read falls in with held rather than with not-held: the
  // wrong "ready" costs a click into a panel that explains itself, and the wrong invite
  // costs roughly 30,000 tokens for a note that may already exist.
  if ((mine && report.status === "ready") || held !== false) {
    return { kind: "ready", startedAt: null, progressFraction: 1 };
  }

  return IDLE_BUTTON_STATE;
}
