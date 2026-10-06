import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useIsPanel } from "../../../app/LayoutContext.js";
import { Routes } from "../../../app/Routes.js";
import { StrokeIcon } from "../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useIsPhone } from "../../../util/useIsPhone.js";
import { useAnalytics } from "../../analytics/AnalyticsContext.js";
import { useCaptureQueueController } from "../CaptureQueueContext.js";
import { AttentionRow } from "../components/AttentionRow/AttentionRow.js";
import { QueueRow } from "../components/QueueRow/QueueRow.js";
import { makingStep } from "../util/makingStep.js";
import { queueHoldNote } from "../util/queueHoldCopy.js";
import { waitingRows } from "../util/queueRows.js";
import styles from "./QueuePage.module.scss";
import { queuePageTestIds } from "./QueuePageTestIds.js";

// Design 27j–27o: what is being made, what waits in order, and what needs the reader, on a
// page of its own. The queue is this device's until OV-11, so the page says where it runs
// rather than promising it happens anywhere (docs/features/capture-queue.md).
export function QueuePage() {
  const queue = useCaptureQueueController();
  const analytics = useAnalytics();
  const isPanel = useIsPanel();
  const isPhone = useIsPhone();
  const stacked = isPanel || isPhone;
  const heading = useRef<HTMLHeadingElement>(null);
  const confirmTitle = useRef<HTMLParagraphElement>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const rows = waitingRows(queue);
  const waitingCount = queue.waiting.length;

  useEffect(() => heading.current?.focus({ preventScroll: true }), []);
  useEffect(() => {
    if (confirmingClear) confirmTitle.current?.focus();
  }, [confirmingClear]);

  const intro = isPanel
    ? "Made while this panel or the extension is open. Continues next time."
    : isPhone
      ? "Made oldest first while The Overview is open on this phone. Continues next time you open it."
      : "Videos from playlists you follow, made one at a time, oldest first, while The Overview is open on this computer. Close it and the queue waits; it continues next time you open The Overview.";

  const pauseControl = queue.needsKey ? null : queue.paused ? (
    <button
      type="button"
      className={stacked ? styles.iconPrimary : styles.primary}
      onClick={() => {
        analytics.queue.controls.resumed({ from: "page" });
        queue.setPaused(false);
      }}
      aria-label={stacked ? "Resume queue" : undefined}
      data-testid={queuePageTestIds.resumeButton}
    >
      <StrokeIcon name="play" size={stacked ? 18 : 13} />
      {!stacked && "Resume queue"}
    </button>
  ) : (
    <button
      type="button"
      className={stacked ? styles.iconSecondary : styles.secondary}
      onClick={() => {
        analytics.queue.controls.paused({ from: "page" });
        queue.setPaused(true);
      }}
      aria-label={stacked ? "Pause queue" : undefined}
      data-testid={queuePageTestIds.pauseButton}
    >
      <StrokeIcon name="pause" size={stacked ? 18 : 13} />
      {!stacked && "Pause queue"}
    </button>
  );

  const clearControl =
    waitingCount === 0 || confirmingClear ? null : (
      <button
        type="button"
        className={stacked ? styles.iconGhost : styles.ghost}
        onClick={() => {
          analytics.queue.controls.clearAsked();
          setConfirmingClear(true);
        }}
        aria-label={stacked ? "Clear queue" : undefined}
        data-testid={queuePageTestIds.clearButton}
      >
        <StrokeIcon name="trash" size={stacked ? 18 : 13} />
        {!stacked && "Clear queue"}
      </button>
    );

  return (
    <div className={`${styles.root} ${stacked ? styles.stacked : ""}`} data-testid={queuePageTestIds.root}>
      <Link className={styles.backLink} to={Routes.home()} data-testid={queuePageTestIds.backLink}>
        <StrokeIcon name="arrowLeft" /> {isPanel ? "Back" : "Overviews"}
      </Link>

      <div className={styles.head}>
        <div className={styles.headText}>
          <h1 ref={heading} className={styles.title} tabIndex={-1} data-testid={queuePageTestIds.heading}>
            Queue
          </h1>
          <p className={styles.intro}>{intro}</p>
        </div>
        <div className={styles.controls}>
          {waitingCount > 0 && pauseControl}
          {clearControl}
        </div>
      </div>

      {confirmingClear && (
        <div className={styles.confirm} role="group" aria-labelledby="queue-clear-title" data-testid={queuePageTestIds.clearConfirm}>
          <p className={styles.confirmText} id="queue-clear-title" ref={confirmTitle} tabIndex={-1}>
            <strong>Clear the queue?</strong> All {waitingCount.toLocaleString("en-GB")} waiting{" "}
            {waitingCount === 1 ? "video is" : "videos are"} removed. Your playlists stay followed, so new videos still
            arrive.
          </p>
          <span className={styles.confirmActions}>
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                void queue.clear().then((removed) => analytics.queue.controls.cleared({ removed }));
                setConfirmingClear(false);
                heading.current?.focus();
              }}
              data-testid={queuePageTestIds.confirmClearButton}
            >
              Clear queue
            </button>
            <button
              type="button"
              className={styles.ghost}
              onClick={() => {
                analytics.queue.controls.clearKept();
                setConfirmingClear(false);
              }}
              data-testid={queuePageTestIds.keepButton}
            >
              Keep
            </button>
          </span>
        </div>
      )}

      {queue.needsKey && waitingCount > 0 && (
        <div className={styles.noKey} data-testid={queuePageTestIds.noKeyNote}>
          <span className={styles.noKeyIcon} aria-hidden="true">
            <StrokeIcon name="key" size={18} />
          </span>
          <p className={styles.noKeyText}>
            Overviews are made with your own API key, and none is saved {isPanel ? "in the extension" : "here"}. Add one
            and the queue starts straight away.
          </p>
          <Link
            className={styles.primary}
            to={Routes.settingsSection("keys")}
            onClick={() => analytics.queue.controls.keysLinkFollowed({ from: "page" })}
            data-testid={queuePageTestIds.addKeyLink}
          >
            Add a key
          </Link>
        </div>
      )}

      {queue.hold !== null && waitingCount > 0 && (
        <div className={styles.held} data-testid={queuePageTestIds.heldNote}>
          <span className={styles.heldIcon} aria-hidden="true">
            <StrokeIcon name="clock" size={18} />
          </span>
          <p className={styles.heldText}>{queueHoldNote(queue.hold, waitingCount, queue.viaExtension)}</p>
        </div>
      )}

      {queue.making !== null && (
        <div className={styles.group}>
          <p className={styles.label}>Making now</p>
          <ul className={styles.list} data-testid={queuePageTestIds.making}>
            <QueueRow capture={queue.making.capture} state="making" position={null} dense {...makingStep(queue.making.run, stacked)} />
          </ul>
        </div>
      )}

      {rows.length > 0 && (
        <div className={styles.group}>
          <p className={styles.label} data-testid={queuePageTestIds.waitingLabel}>
            Waiting · {rows.length.toLocaleString("en-GB")}
          </p>
          <ol className={styles.list} data-testid={queuePageTestIds.waiting}>
            {rows.map(({ capture, state, resumeTime }, index) => (
              <QueueRow
                key={capture.videoId}
                capture={capture}
                state={state}
                position={index + 1}
                resumeTime={resumeTime}
                dense
                onRemove={() => {
                  analytics.queue.item.removed();
                  queue.remove(capture.videoId);
                }}
              />
            ))}
          </ol>
        </div>
      )}

      {queue.attention.length > 0 && (
        <div className={styles.group} id="needs-attention">
          <p className={styles.label} data-testid={queuePageTestIds.attentionLabel}>
            Needs attention · {queue.attention.length.toLocaleString("en-GB")}
          </p>
          <ul className={styles.attentionList} data-testid={queuePageTestIds.attention}>
            {queue.attention.map((capture) => (
              <AttentionRow
                key={capture.videoId}
                capture={capture}
                stacked={stacked}
                onRetry={() => {
                  analytics.queue.item.retried({ problem: capture.problem ?? "failed" });
                  queue.retry(capture.videoId);
                }}
                onDismiss={() => {
                  analytics.queue.item.dismissed({ problem: capture.problem ?? "failed" });
                  queue.dismiss(capture.videoId);
                }}
              />
            ))}
          </ul>
        </div>
      )}

      {queue.making === null && waitingCount === 0 && queue.attention.length === 0 && (
        <div className={styles.empty} data-testid={queuePageTestIds.empty}>
          <p className={styles.emptyTitle}>Nothing is waiting</p>
          <p className={styles.emptyBody}>
            New videos in the playlists you follow are queued each time you open The Overview.{" "}
            <Link to={Routes.settingsSection("playlists")}>Your playlists</Link>
          </p>
        </div>
      )}
    </div>
  );
}
