import type { TimeRange } from "@overview/domain";
import { usePlaybackPosition } from "../../../app/PlaybackContext.js";

export const usePlayingStep = (steps: readonly { range?: TimeRange | null | undefined }[], videoId: string | null): number | null => {
  const position = usePlaybackPosition(videoId);
  if (position === null) {
    return null;
  }
  const at = steps.findIndex(({ range }) => range != null && position.positionMs >= range.startMs && position.positionMs < range.endMs);
  return at === -1 ? null : at;
};
