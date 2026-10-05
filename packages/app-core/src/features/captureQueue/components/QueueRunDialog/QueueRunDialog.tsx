import { useEffect, useRef } from "react";
import { formatClock } from "@overview/domain";
import { OverviewThumbnail } from "../../../../components/shared/OverviewThumbnail/OverviewThumbnail.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { GenerationSteps } from "../../../newOverview/components/GenerationSteps/GenerationSteps.js";
import { useElapsedSeconds } from "../../../newOverview/useElapsedSeconds.js";
import type { QueueMaking } from "../../useCaptureQueue.js";
import styles from "./QueueRunDialog.module.scss";
import { queueRunDialogTestIds } from "./QueueRunDialogTestIds.js";

export interface QueueRunDialogProps {
  making: QueueMaking | null;
  open: boolean;
  onClose: () => void;
}

const HEADING_ID = "QueueRunDialog-heading";

// The strip's Details: the progress of the video the queue is making, as the New dialog
// shows a run (design 5a). Closing it leaves the queue running.
export function QueueRunDialog({ making, open, onClose }: QueueRunDialogProps) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const shown = open && making !== null;
  const elapsedSeconds = useElapsedSeconds(making?.run.startedAt ?? Date.now(), making?.run.finishedAt ?? null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (shown && !element.open) element.showModal();
    if (!shown && element.open) element.close();
  }, [shown]);

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={HEADING_ID}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      data-testid={queueRunDialogTestIds.root}
    >
      {making !== null && (
        <div className={styles.panel}>
          <span className={styles.handle} aria-hidden="true" />
          <div className={styles.head}>
            {making.run.video !== null && <OverviewThumbnail video={making.run.video} className={styles.thumbnail} />}
            <div className={styles.sourceText}>
              <p className={styles.kicker}>
                <StrokeIcon name="listVideo" size={14} />
                From {making.capture.fromPlaylist.title}
              </p>
              <h2 className={styles.heading} id={HEADING_ID} data-testid={queueRunDialogTestIds.title}>
                {making.run.video?.title ?? making.capture.title}
              </h2>
            </div>
            <button type="button" className={styles.close} onClick={onClose} aria-label="Close" data-testid={queueRunDialogTestIds.closeButton}>
              <StrokeIcon name="close" size={16} />
            </button>
          </div>
          <GenerationSteps run={making.run} />
          <p className={styles.foot}>
            <span className={styles.elapsed}>{formatClock(elapsedSeconds)} elapsed</span> · Closing this leaves the queue running.
          </p>
        </div>
      )}
    </dialog>
  );
}
