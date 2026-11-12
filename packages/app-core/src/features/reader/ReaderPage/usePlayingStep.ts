import type { TimeRange } from "@overview/domain";
import { usePlaybackPosition } from "../../../app/PlaybackContext.js";

// The step, of a recipe's method or of the steps a source gives, whose stretch holds the playhead of the video beside the panel, measured by the
// player and never worked out (design 122i). Null between steps, and wherever no player reports.
export function usePlayingStep(steps: readonly { range?: TimeRange | null | undefined }[], videoId: string | null): number | null {
  const position = usePlaybackPosition(videoId);
  if (position === null) return null;
  const at = steps.findIndex(({ range }) => range != null && position.positionMs >= range.startMs && position.positionMs < range.endMs);
  return at === -1 ? null : at;
}
