import { queueOriginOf, type QueuedCapture } from "@overview/domain";

const REASONS: Record<NonNullable<QueuedCapture["problem"]>, string> = {
  noCaptions: "No captions, so there was nothing to read. Try again if the channel adds them.",
  private: "Made private on YouTube, so we can’t read it.",
  deleted: "Deleted from YouTube.",
  unavailable: "YouTube won’t show this video here.",
  needsTranscribing: "This episode needs transcribing, which uses your hours. Make it now to transcribe it.",
  failed: "Something went wrong making it. Try again.",
};

export const queueProblemText = (capture: QueuedCapture): string => {
  return `${REASONS[capture.problem ?? "failed"]} From ${queueOriginOf(capture).title}.`;
};
