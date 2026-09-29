import { useEffect } from "react";
import type { Overview } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
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

// Design 3c: the run, once it has left the dialog, as one line on a surface card under
// the bar — a mark, the label, then step, clock and title receding to the muted ink —
// with a brand-orange bar at its foot while it runs. Ready, it moves to the stone tint
// and offers the one action that makes something (docs/features/stone-theme.md).
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

  const state = status.isRunning ? "running" : status.isReady ? "ready" : "failed";

  return (
    <div
      className={styles.root}
      role="status"
      aria-live="polite"
      data-state={state}
      data-testid={generationStatusStripTestIds.root}
    >
      <span className={styles.text}>
        <span className={`${styles.mark} ${status.isFailed ? styles.markFailed : ""}`} aria-hidden="true">
          {status.isRunning ? (
            <span className={styles.dot} />
          ) : (
            <StrokeIcon name={status.isReady ? "check" : "close"} size={16} />
          )}
        </span>
        <span className={styles.label} data-testid={generationStatusStripTestIds.label}>
          {status.label}
        </span>
        <span className={styles.detail}>
          <span data-testid={generationStatusStripTestIds.step}>
            {status.step} · {formatClock(elapsedSeconds)}
          </span>
          {" · "}
          {run.video?.title ?? run.url}
        </span>
      </span>

      <span className={styles.actions}>
        {status.isReady ? (
          <button
            type="button"
            className={styles.readAction}
            onClick={() => onReadOverview(run.overview!)}
            data-testid={generationStatusStripTestIds.readOverviewButton}
          >
            Read overview
          </button>
        ) : (
          <button
            type="button"
            className={styles.detailsAction}
            onClick={onDetails}
            data-testid={generationStatusStripTestIds.detailsButton}
          >
            Details
          </button>
        )}
        {status.isRunning ? (
          <button
            type="button"
            className={styles.cancelAction}
            onClick={onDismiss}
            aria-label="Cancel"
            data-testid={generationStatusStripTestIds.dismissButton}
          >
            Cancel
          </button>
        ) : (
          <button
            type="button"
            className={styles.dismissAction}
            onClick={onDismiss}
            aria-label="Dismiss"
            data-testid={generationStatusStripTestIds.dismissButton}
          >
            <StrokeIcon name="close" size={16} />
          </button>
        )}
      </span>

      {!status.isReady && (
        <span className={styles.barTrack} aria-hidden="true">
          <span
            className={styles.barFill}
            style={{ width: `${Math.round(status.progressFraction * 100)}%` }}
          />
        </span>
      )}
    </div>
  );
}
