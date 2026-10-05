import type { QueuedCapture } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { queueProblemText } from "../../util/queueProblemText.js";
import styles from "./AttentionRow.module.scss";
import { attentionRowTestIds } from "./AttentionRowTestIds.js";

export interface AttentionRowProps {
  capture: QueuedCapture;
  stacked: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}

// Design 27j–27l: Failed and Skipped spelled out in a tag as well as coloured, the reason in
// words, and only the action that can work: a failed video can be tried again, a skipped one
// only dismissed.
export function AttentionRow({ capture, stacked, onRetry, onDismiss }: AttentionRowProps) {
  const failed = capture.status === "failed";
  const gone = capture.problem === "deleted";
  return (
    <li className={`${styles.root} ${stacked ? styles.stacked : ""}`} data-status={capture.status} data-testid={attentionRowTestIds.root}>
      <span className={styles.body}>
        <span className={`${styles.thumb} ${gone ? styles.thumbGone : ""}`} aria-hidden="true">
          {gone || capture.thumbnailUrl === null ? (
            <StrokeIcon name={gone ? "ban" : "play"} size={15} />
          ) : (
            <img src={capture.thumbnailUrl} alt="" loading="lazy" />
          )}
        </span>
        <span className={styles.text}>
          <span className={styles.head}>
            <span className={failed ? styles.tagFailed : styles.tagSkipped} data-testid={attentionRowTestIds.tag}>
              {failed ? "Failed" : "Skipped"}
            </span>
            <span className={`${styles.title} ${gone ? styles.titleGone : ""}`} data-testid={attentionRowTestIds.title}>
              {capture.title}
            </span>
          </span>
          <span className={styles.reason} data-testid={attentionRowTestIds.reason}>
            {queueProblemText(capture)}
          </span>
        </span>
      </span>
      <span className={styles.actions}>
        {failed && (
          <button
            type="button"
            className={styles.retry}
            onClick={onRetry}
            aria-label={`Try “${capture.title}” again`}
            data-testid={attentionRowTestIds.retryButton}
          >
            <StrokeIcon name="refresh" size={14} />
            Try again
          </button>
        )}
        <button
          type="button"
          className={styles.dismiss}
          onClick={onDismiss}
          aria-label={`Dismiss “${capture.title}”`}
          data-testid={attentionRowTestIds.dismissButton}
        >
          Dismiss
        </button>
      </span>
    </li>
  );
}
