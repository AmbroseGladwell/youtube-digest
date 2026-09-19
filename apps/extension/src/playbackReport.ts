import type { PlaybackPosition } from "@overview/app-core";

export const PLAYBACK_REPORT = "overview/playback";

export interface PlaybackReport extends PlaybackPosition {
  type: typeof PLAYBACK_REPORT;
}

export function isPlaybackReport(message: unknown): message is PlaybackReport {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === PLAYBACK_REPORT
  );
}
