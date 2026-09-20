import type { TimeRange, VideoId } from "@overview/types";
import { useSeekPlayback } from "../../../../app/PlaybackContext.js";
import { formatTimeRange } from "../../../overviews/util/formatTimeRange.js";
import { formatTimestamp } from "../../../../util/formatTimestamp.js";
import styles from "./WatchAnywayJump.module.scss";
import { watchAnywayJumpTestIds } from "./WatchAnywayJumpTestIds.js";

export interface WatchAnywayJumpProps {
  range: TimeRange;
  videoId: VideoId | null;
}

// Under the paragraph that says a stretch is worth watching, the stretch itself. The
// range is printed whether or not there is a player to move, because reading it is how
// someone gets there on their own; the button appears only where the video it would
// move is actually in front of the panel (docs/features/following-playback.md).
export function WatchAnywayJump({ range, videoId }: WatchAnywayJumpProps) {
  const seek = useSeekPlayback(videoId);

  return (
    <p className={styles.root} data-testid={watchAnywayJumpTestIds.root}>
      <span className={styles.range} data-testid={watchAnywayJumpTestIds.range}>
        {formatTimeRange(range.startMs, range.endMs)}
      </span>
      {seek !== null && (
        <button
          type="button"
          className={styles.skip}
          onClick={() => seek(range.startMs)}
          aria-label={`Skip the video to ${formatTimestamp(range.startMs)}`}
          data-testid={watchAnywayJumpTestIds.skipButton}
        >
          Skip to {formatTimestamp(range.startMs)}
        </button>
      )}
    </p>
  );
}
