import { useEffect, useRef, useState } from "react";
import { DUBIOUS_BASIS_LABEL, formatTimestamp, youtubeTimestampUrl } from "@overview/domain";
import type { DubiousClaim, VideoSource } from "@overview/domain";
import { useSeekPlayback } from "../../../../app/PlaybackContext.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useReaderAnalytics } from "../../../analytics/OverviewAnalyticsContext.js";
import styles from "./DubiousReasonsPanel.module.scss";
import { dubiousReasonsPanelTestIds } from "./DubiousReasonsPanelTestIds.js";

export const DUBIOUS_REASONS_PANEL_ID = "DubiousReasonsPanel";
const HEADING_ID = "DubiousReasonsPanel-heading";

export interface DubiousReasonsPanelProps {
  dubiousClaims: DubiousClaim[] | null;
  video: VideoSource;
  onClose: () => void;
}

// Design OV-85 (85b–85g): an inline disclosure under the byline rather than a modal
// (docs/features/dubious-reasons.md).
export function DubiousReasonsPanel({ dubiousClaims, video, onClose }: DubiousReasonsPanelProps) {
  const heading = useRef<HTMLHeadingElement | null>(null);
  const thanks = useRef<HTMLSpanElement | null>(null);
  const seek = useSeekPlayback(video.id);
  const analytics = useReaderAnalytics();
  const [markedWrong, setMarkedWrong] = useState(false);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  useEffect(() => {
    if (markedWrong) {
      thanks.current?.focus();
    }
  }, [markedWrong]);

  return (
    <section
      id={DUBIOUS_REASONS_PANEL_ID}
      className={styles.root}
      aria-labelledby={HEADING_ID}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
      data-testid={dubiousReasonsPanelTestIds.root}
    >
      <div className={styles.panel}>
        <div className={styles.top}>
          <div className={styles.titles}>
            <h2
              className={styles.heading}
              id={HEADING_ID}
              ref={heading}
              tabIndex={-1}
              data-testid={dubiousReasonsPanelTestIds.heading}
            >
              Why it’s flagged
            </h2>
            {dubiousClaims !== null && dubiousClaims.length > 1 && (
              <p className={styles.count} data-testid={dubiousReasonsPanelTestIds.count}>
                {dubiousClaims.length} claims, worst first
              </p>
            )}
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close"
            data-testid={dubiousReasonsPanelTestIds.closeButton}
          >
            <StrokeIcon name="close" size={16} />
          </button>
        </div>

        {dubiousClaims === null ? (
          <p className={styles.reason} data-testid={dubiousReasonsPanelTestIds.noReasonSaved}>
            No reason was saved with this overview. It was made before overviews explained their
            flags.
          </p>
        ) : (
          <ol className={styles.items}>
            {dubiousClaims.map((dubiousClaim, index) => (
              <li key={index} className={styles.item} data-testid={dubiousReasonsPanelTestIds.reason}>
                <p className={styles.basis} data-testid={dubiousReasonsPanelTestIds.basis}>
                  {DUBIOUS_BASIS_LABEL[dubiousClaim.basis]}
                </p>
                <blockquote className={styles.claim} data-testid={dubiousReasonsPanelTestIds.claim}>
                  “{dubiousClaim.claim}”
                </blockquote>
                <p className={styles.reason}>{dubiousClaim.reason}</p>
                {dubiousClaim.startMs !== null && (
                  <div>
                    {seek === null ? (
                      <a
                        className={styles.moment}
                        href={youtubeTimestampUrl(video.url, dubiousClaim.startMs)}
                        target="_blank"
                        rel="noopener"
                        onClick={() => analytics.dubiousReasons.momentFollowed({ by: "youtube" })}
                        aria-label={`Watch this claim from ${formatTimestamp(dubiousClaim.startMs)} on YouTube, opens in a new tab`}
                        data-testid={dubiousReasonsPanelTestIds.watchLink}
                      >
                        <StrokeIcon name="openOut" size={14} />
                        Watch from {formatTimestamp(dubiousClaim.startMs)}
                      </a>
                    ) : (
                      <button
                        type="button"
                        className={styles.moment}
                        onClick={() => {
                          analytics.dubiousReasons.momentFollowed({ by: "skip" });
                          seek(dubiousClaim.startMs!);
                        }}
                        aria-label={`Skip the video to ${formatTimestamp(dubiousClaim.startMs)}`}
                        data-testid={dubiousReasonsPanelTestIds.skipButton}
                      >
                        <StrokeIcon name="skipForward" size={14} />
                        Skip to {formatTimestamp(dubiousClaim.startMs)}
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}

        <div className={styles.foot}>
          {!markedWrong && (
            <button
              type="button"
              className={styles.looksWrong}
              onClick={() => {
                analytics.dubiousReasons.markedWrong();
                setMarkedWrong(true);
              }}
              data-testid={dubiousReasonsPanelTestIds.looksWrongButton}
            >
              <StrokeIcon name="flag" size={14} />
              This looks wrong
            </button>
          )}
          <p className={styles.feedback} role="status" aria-live="polite">
            {markedWrong && (
              <span className={styles.thanks} ref={thanks} tabIndex={-1} data-testid={dubiousReasonsPanelTestIds.looksWrongThanks}>
                <StrokeIcon name="check" size={14} />
                Thanks, noted.
              </span>
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
