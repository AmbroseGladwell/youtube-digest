import { Link } from "react-router";
import { Routes } from "../../../../app/Routes.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useIsPhone } from "../../../../util/useIsPhone.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useCaptureQueueController } from "../../CaptureQueueContext.js";
import { makingStep } from "../../util/makingStep.js";
import { attentionSummary, waitingRows } from "../../util/queueRows.js";
import { QueueRow } from "../QueueRow/QueueRow.js";
import styles from "./LibraryQueueGroup.module.scss";
import { libraryQueueGroupTestIds } from "./LibraryQueueGroupTestIds.js";

const GROUP_ID = "library-queue-group";
const SHOWN_WAITING = 2;

// Design 27i: pending videos together in a recessed group above the finished tiles, showing
// what is being made and the next two. Folded, it lives in the strip instead (27i-2).
export function LibraryQueueGroup() {
  const queue = useCaptureQueueController();
  const analytics = useAnalytics();
  const phone = useIsPhone();
  const rows = waitingRows(queue).slice(0, queue.making === null ? SHOWN_WAITING + 1 : SHOWN_WAITING);
  const waitingCount = queue.waiting.length;

  // Folded only while the strip is there to unfold it from.
  if ((queue.folded && queue.strip !== null) || (waitingCount === 0 && queue.attention.length === 0)) return null;

  return (
    <section className={styles.root} id={GROUP_ID} aria-labelledby={`${GROUP_ID}-heading`} data-testid={libraryQueueGroupTestIds.root}>
      <div className={styles.head}>
        <span className={styles.headText}>
          <h2 className={styles.heading} id={`${GROUP_ID}-heading`} data-testid={libraryQueueGroupTestIds.heading}>
            Queue <span className={styles.count}>· {waitingCount.toLocaleString("en-GB")} waiting</span>
          </h2>
          {!phone && <span className={styles.sub}>Made oldest first while The Overview is open</span>}
        </span>
        <span className={styles.headActions}>
          <Link
            className={styles.seeQueue}
            to={Routes.queue()}
            onClick={() => analytics.queue.controls.opened({ from: "libraryGroup" })}
            data-testid={libraryQueueGroupTestIds.seeQueueLink}
          >
            {phone ? "See all" : "See queue"}
            <StrokeIcon name="chevronRight" size={14} />
          </Link>
          <button
            type="button"
            className={styles.fold}
            onClick={() => {
              analytics.queue.controls.folded({ folded: true });
              queue.setFolded(true);
            }}
            aria-expanded={true}
            aria-controls={GROUP_ID}
            aria-label="Collapse queue"
            data-testid={libraryQueueGroupTestIds.foldButton}
          >
            <StrokeIcon name="chevronUp" size={16} />
          </button>
        </span>
      </div>
      {(queue.making !== null || rows.length > 0) && (
        <ul className={styles.list}>
          {queue.making !== null && (
            <QueueRow
              capture={queue.making.capture}
              state="making"
              position={null}
              {...makingStep(queue.making.run, phone)}
              dense={phone}
            />
          )}
          {rows.map(({ capture, state }) => (
            <QueueRow key={capture.videoId} capture={capture} state={state} position={null} dense={phone} />
          ))}
        </ul>
      )}
      {queue.attention.length > 0 && (
        <Link
          className={styles.attention}
          to={Routes.queue()}
          onClick={() => analytics.queue.controls.opened({ from: "attention" })}
          data-testid={libraryQueueGroupTestIds.attentionLink}
        >
          <StrokeIcon name="alert" size={15} />
          {queue.attention.length} need attention
          {!phone && <span className={styles.attentionDetail}>· {attentionSummary(queue.attention)}</span>}
        </Link>
      )}
    </section>
  );
}
