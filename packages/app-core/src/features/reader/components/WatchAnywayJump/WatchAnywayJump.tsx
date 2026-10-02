import { formatTimestamp, youtubeTimestampUrl } from "@overview/domain";
import type { TimeRange, VideoSource } from "@overview/domain";
import { useSeekPlayback } from "../../../../app/PlaybackContext.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useOverviewPageAnalytics } from "../../../analytics/OverviewAnalyticsContext.js";
import { formatTimeRange } from "../../../overviews/util/formatTimeRange.js";
import styles from "./WatchAnywayJump.module.scss";
import { watchAnywayJumpTestIds } from "./WatchAnywayJumpTestIds.js";

export interface WatchAnywayJumpProps {
  range: TimeRange;
  video: VideoSource;
}

// Under the paragraph that says a stretch is worth watching, the stretch itself, and a way
// to reach it. Where the video is in front of the panel that is a skip, which moves the
// player already playing it (docs/features/following-playback.md); everywhere else it is a
// link that opens the video at that moment, the same link a chapter and a transcript
// timestamp give. The range is printed either way.
export function WatchAnywayJump({ range, video }: WatchAnywayJumpProps) {
  const seek = useSeekPlayback(video.id);
  const analytics = useOverviewPageAnalytics();

  return (
    <p className={styles.root} data-testid={watchAnywayJumpTestIds.root}>
      <span className={styles.range} data-testid={watchAnywayJumpTestIds.range}>
        {formatTimeRange(range.startMs, range.endMs)}
      </span>
      {seek === null ? (
        <a
          className={styles.skip}
          href={youtubeTimestampUrl(video.url, range.startMs)}
          target="_blank"
          rel="noopener"
          onClick={() => analytics.watchAnyway.followed({ by: "youtube" })}
          aria-label={`Watch from ${formatTimestamp(range.startMs)} on YouTube, opens in a new tab`}
          data-testid={watchAnywayJumpTestIds.watchLink}
        >
          Watch from {formatTimestamp(range.startMs)}
          <StrokeIcon name="openOut" size={12} />
        </a>
      ) : (
        <button
          type="button"
          className={styles.skip}
          onClick={() => {
            analytics.watchAnyway.followed({ by: "skip" });
            seek(range.startMs);
          }}
          aria-label={`Skip the video to ${formatTimestamp(range.startMs)}`}
          data-testid={watchAnywayJumpTestIds.skipButton}
        >
          Skip to {formatTimestamp(range.startMs)}
        </button>
      )}
    </p>
  );
}
