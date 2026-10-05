import { Link } from "react-router";
import { Routes } from "../../../../app/Routes.js";
import { StrokeIcon, type StrokeIconName } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import type { CaptureQueueStrip } from "../../types/CaptureQueueStrip.js";
import { captureQueueStripCopy } from "../../util/captureQueueStripCopy.js";
import styles from "./CaptureQueueStripView.module.scss";
import { captureQueueStripViewTestIds } from "./CaptureQueueStripViewTestIds.js";

export interface CaptureQueueStripViewProps {
  strip: CaptureQueueStrip;
  compact: boolean;
  // The library's queue group folded into this strip: the count of problems rides along and
  // the strip offers to unfold it (design 27i-2). Null where there is no group to unfold.
  folded: { attention: number; onUnfold: () => void } | null;
  onPause: () => void;
  onResume: () => void;
  onDetails: () => void;
  onDismiss: () => void;
}

const LEAD: Record<CaptureQueueStrip["kind"], StrokeIconName | null> = {
  making: null,
  paused: "pause",
  checked: "refresh",
  noKey: "key",
  attention: "alert",
  done: "check",
};

// Design 27k: the queue in the generation strip's slot and shape (3c), one state at a time.
// Its words are a polite live region, so progress is heard without taking focus.
export function CaptureQueueStripView({ strip, compact, folded, onPause, onResume, onDetails, onDismiss }: CaptureQueueStripViewProps) {
  const analytics = useAnalytics();
  const copy = captureQueueStripCopy(strip, compact);
  const lead = LEAD[strip.kind];
  const warns = strip.kind === "noKey" || strip.kind === "attention";

  const queueLink = (label: string | null) => (
    <Link
      className={label === null ? styles.iconAction : styles.ghostAction}
      to={Routes.queue()}
      aria-label={label === null ? "Open queue" : undefined}
      onClick={() => analytics.queue.controls.opened({ from: "strip" })}
      data-testid={captureQueueStripViewTestIds.queueLink}
    >
      {label}
      <StrokeIcon name="chevronRight" size={compact ? 18 : 14} />
    </Link>
  );

  const pause = (
    <button
      type="button"
      className={compact ? styles.iconAction : styles.ghostAction}
      onClick={() => {
        analytics.queue.controls.paused({ from: "strip" });
        onPause();
      }}
      aria-label={compact ? "Pause queue" : undefined}
      data-testid={captureQueueStripViewTestIds.pauseButton}
    >
      <StrokeIcon name="pause" size={compact ? 18 : 14} />
      {!compact && "Pause"}
    </button>
  );

  const resume = (
    <button
      type="button"
      className={styles.primaryAction}
      onClick={() => {
        analytics.queue.controls.resumed({ from: "strip" });
        onResume();
      }}
      data-testid={captureQueueStripViewTestIds.resumeButton}
    >
      <StrokeIcon name="play" size={13} />
      Resume
    </button>
  );

  const dismiss = (
    <button
      type="button"
      className={styles.iconAction}
      onClick={() => {
        analytics.queue.controls.doneDismissed();
        onDismiss();
      }}
      aria-label="Dismiss"
      data-testid={captureQueueStripViewTestIds.dismissButton}
    >
      <StrokeIcon name="close" size={16} />
    </button>
  );

  const unfold =
    folded === null ? null : (
      <button
        type="button"
        className={compact ? styles.iconAction : styles.ghostAction}
        onClick={() => {
          analytics.queue.controls.folded({ folded: false });
          folded.onUnfold();
        }}
        aria-expanded={false}
        aria-label={compact ? "Show queue" : undefined}
        data-testid={captureQueueStripViewTestIds.showQueueButton}
      >
        {!compact && "Show queue"}
        <StrokeIcon name="chevronDown" size={compact ? 18 : 14} />
      </button>
    );

  const actions = (() => {
    switch (strip.kind) {
      case "making":
        return (
          <>
            {!compact && (
              <button
                type="button"
                className={styles.ghostAction}
                onClick={() => {
                  analytics.queue.controls.detailsOpened();
                  onDetails();
                }}
                data-testid={captureQueueStripViewTestIds.detailsButton}
              >
                Details
              </button>
            )}
            {pause}
            {unfold ?? queueLink(compact ? null : "Queue")}
          </>
        );
      case "paused":
        return (
          <>
            {resume}
            {unfold ?? queueLink(compact ? null : "Queue")}
          </>
        );
      case "checked":
        return unfold ?? queueLink(compact ? null : "Queue");
      case "noKey":
        return (
          <>
            <Link
              className={styles.primaryAction}
              to={Routes.settingsSection("keys")}
              onClick={() => analytics.queue.controls.keysLinkFollowed({ from: "strip" })}
              data-testid={captureQueueStripViewTestIds.addKeyLink}
            >
              Add a key
            </Link>
            {!compact && queueLink("Queue")}
          </>
        );
      case "attention":
        return (
          <>
            {queueLink(compact ? null : "See queue")}
            {dismiss}
          </>
        );
      case "done":
        return dismiss;
    }
  })();

  return (
    <div
      className={`${styles.root} ${compact ? styles.compact : ""}`}
      role="status"
      aria-live="polite"
      data-state={strip.kind}
      data-testid={captureQueueStripViewTestIds.root}
    >
      <span className={styles.text}>
        <span className={`${styles.lead} ${warns ? styles.leadWarn : ""}`} aria-hidden="true">
          {lead === null ? <span className={styles.dot} /> : <StrokeIcon name={lead} size={16} />}
        </span>
        <span className={styles.words}>
          <span className={styles.title} data-testid={captureQueueStripViewTestIds.title}>
            {copy.title}
          </span>
          {copy.meta !== null && (
            <span className={styles.meta} data-testid={captureQueueStripViewTestIds.meta}>
              {copy.meta}
            </span>
          )}
          {folded !== null && folded.attention > 0 && (
            <span className={styles.attention} data-testid={captureQueueStripViewTestIds.attention}>
              · {folded.attention} need attention
            </span>
          )}
        </span>
      </span>
      <span className={styles.actions}>{actions}</span>
      {strip.kind === "making" && (
        <span className={styles.barTrack} aria-hidden="true">
          <span className={styles.barFill} style={{ width: `${strip.progress}%` }} />
        </span>
      )}
    </div>
  );
}
