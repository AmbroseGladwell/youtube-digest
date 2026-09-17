import { useEffect } from "react";
import type { Overview } from "@overview/types";
import { formatClock } from "../../../../util/formatClock.js";
import type { NewOverviewRun } from "../../types/NewOverviewRun.js";
import { generationRunStatus } from "../../util/generationRunStatus.js";
import { useElapsedSeconds } from "../../useElapsedSeconds.js";
import { READY_DISMISS_MS } from "./readyDismissMs.js";
import styles from "./GenerationStatusStrip.module.scss";
import { generationStatusStripTestIds } from "./GenerationStatusStripTestIds.js";

export interface GenerationStatusStripProps {
  run: NewOverviewRun;
  onDetails: () => void;
  onDismiss: () => void;
  onReadOverview: (overview: Overview) => void;
}

export function GenerationStatusStrip({
  run,
  onDetails,
  onDismiss,
  onReadOverview,
}: GenerationStatusStripProps) {
  const status = generationRunStatus(run);
  const elapsedSeconds = useElapsedSeconds(run.startedAt, run.finishedAt);

  useEffect(() => {
    if (!status.isReady) {
      return;
    }
    const timer = setTimeout(onDismiss, READY_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [status.isReady, onDismiss]);

  return (
    <div
      className={styles.root}
      role="status"
      aria-live="polite"
      data-testid={generationStatusStripTestIds.root}
    >
      <div className={styles.row}>
        <span className={`${styles.mark} ${status.isRunning ? styles.markRunning : ""}`} aria-hidden="true">
          {status.isRunning ? "●" : status.isReady ? "✓" : "✕"}
        </span>

        <span className={styles.text}>
          <span className={styles.label} data-testid={generationStatusStripTestIds.label}>
            {status.label}
          </span>
          <span className={styles.detail}>
            <span className={styles.step} data-testid={generationStatusStripTestIds.step}>
              {status.step} · {formatClock(elapsedSeconds)}
            </span>
            <span className={styles.title}>{run.video?.title ?? run.url}</span>
          </span>
        </span>

        <span className={styles.actions}>
          {status.isReady ? (
            <button
              type="button"
              className={styles.primaryAction}
              onClick={() => onReadOverview(run.overview!)}
              data-testid={generationStatusStripTestIds.readOverviewButton}
            >
              Read overview
            </button>
          ) : (
            <button
              type="button"
              className={styles.primaryAction}
              onClick={onDetails}
              data-testid={generationStatusStripTestIds.detailsButton}
            >
              Details
            </button>
          )}
          <button
            type="button"
            className={styles.quietAction}
            onClick={onDismiss}
            aria-label={status.isRunning ? "Cancel" : "Dismiss"}
            data-testid={generationStatusStripTestIds.dismissButton}
          >
            {status.isRunning ? "Cancel" : "✕"}
          </button>
        </span>
      </div>

      <span className={styles.barTrack} aria-hidden="true">
        <span
          className={styles.barFill}
          style={{ width: `${Math.round(status.progressFraction * 100)}%` }}
        />
      </span>
    </div>
  );
}
