import type { QueuedCapture } from "@overview/domain";

const REASONS: Record<NonNullable<QueuedCapture["problem"]>, string> = {
  noCaptions: "No captions, so there was nothing to read. Try again if the channel adds them.",
  private: "Made private on YouTube, so we can’t read it.",
  deleted: "Deleted from YouTube.",
  unavailable: "YouTube won’t show this video here.",
  failed: "Something went wrong making it. Try again.",
};

// Design 27j: the reason, then where it came from.
export function queueProblemText(capture: QueuedCapture): string {
  return `${REASONS[capture.problem ?? "failed"]} From ${capture.fromPlaylist.title}.`;
}
