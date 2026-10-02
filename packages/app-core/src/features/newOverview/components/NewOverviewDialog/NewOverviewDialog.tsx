import { formatClock } from "@overview/domain";
import { useEffect, useRef, useState } from "react";
import type { Overview } from "@overview/domain";
import { useActiveVideoUrl } from "../../../../app/ActiveVideoContext.js";
import { useSurface } from "../../../../app/SurfaceContext.js";
import { OverviewThumbnail } from "../../../../components/shared/OverviewThumbnail/OverviewThumbnail.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import type { NewOverviewRun } from "../../types/NewOverviewRun.js";
import { useElapsedSeconds } from "../../useElapsedSeconds.js";
import { CaptureReasonField } from "../CaptureReasonField/CaptureReasonField.js";
import { GenerateOverviewForm } from "../GenerateOverviewForm/GenerateOverviewForm.js";
import { GenerationSteps } from "../GenerationSteps/GenerationSteps.js";
import styles from "./NewOverviewDialog.module.scss";
import { newOverviewDialogTestIds } from "./NewOverviewDialogTestIds.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";

export interface NewOverviewDialogProps {
  open: boolean;
  run: NewOverviewRun | null;
  onSubmit: (url: string) => void;
  onClose: () => void;
  onDismiss: () => void;
  onReadOverview: (overview: Overview) => void;
  onCaptureReasonChange: (captureReason: string) => void;
  onCaptureReasonCommit: () => void;
}

const HEADING_ID = "NewOverviewDialog-heading";

export function NewOverviewDialog({
  open,
  run,
  onSubmit,
  onClose,
  onDismiss,
  onReadOverview,
  onCaptureReasonChange,
  onCaptureReasonCommit,
}: NewOverviewDialogProps) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const activeVideoUrl = useActiveVideoUrl();
  const [url, setUrl] = useState("");

  // Native <dialog> rather than a hand-rolled overlay: showModal() is what makes the page
  // behind it inert and keeps focus inside, and Escape arrives as a cancel event.
  useEffect(() => {
    const element = dialog.current;
    if (!element) {
      return;
    }
    if (open && !element.open) {
      if (run === null) {
        setUrl(activeVideoUrl ?? "");
      }
      element.showModal();
    }
    if (!open && element.open) {
      element.close();
    }
  }, [open, activeVideoUrl]);

  const inProgress = run !== null && run.overview === null && run.error === null;

  // Closing a running generation hands it to the status strip; closing anything else is
  // done with it (docs/features/overview-redesign.md, "Generating in the background").
  const analytics = useAnalytics();
  const closeForm = () => {
    analytics.capture.newOverviewDialog.closed({ run: run === null ? "none" : "failed" });
    onDismiss();
  };
  const requestClose = () => {
    if (inProgress) {
      analytics.capture.newOverviewDialog.closed({ run: "running" });
      onClose();
      return;
    }
    if (run !== null && run.overview !== null) analytics.capture.newOverviewDialog.runDismissed({ run: "ready" });
    else analytics.capture.newOverviewDialog.closed({ run: run === null ? "none" : "failed" });
    onDismiss();
  };

  const handleSubmit = (submittedUrl: string) => {
    setUrl(submittedUrl);
    onSubmit(submittedUrl);
  };

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={HEADING_ID}
      aria-busy={inProgress}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) {
          requestClose();
        }
      }}
      data-testid={newOverviewDialogTestIds.root}
    >
      <div className={styles.panel}>
        <span className={styles.handle} aria-hidden="true" />

        {run === null || run.error !== null ? (
          <>
            <div className={styles.head}>
              <h2 className={styles.heading} id={HEADING_ID}>
                New overview
              </h2>
              <button
                type="button"
                className={styles.close}
                onClick={closeForm}
                aria-label="Close"
                data-testid={newOverviewDialogTestIds.closeButton}
              >
                <StrokeIcon name="close" size={16} />
              </button>
            </div>
            <GenerateOverviewForm
              url={url}
              onUrlChange={setUrl}
              onSubmit={handleSubmit}
              onCancel={closeForm}
              generationError={run?.error ?? null}
            />
          </>
        ) : (
          <RunProgress
            run={run}
            headingId={HEADING_ID}
            onClose={onClose}
            onDismiss={onDismiss}
            onReadOverview={onReadOverview}
            onCaptureReasonChange={onCaptureReasonChange}
            onCaptureReasonCommit={onCaptureReasonCommit}
          />
        )}
      </div>
    </dialog>
  );
}

interface RunProgressProps {
  run: NewOverviewRun;
  headingId: string;
  onClose: () => void;
  onDismiss: () => void;
  onReadOverview: (overview: Overview) => void;
  onCaptureReasonChange: (captureReason: string) => void;
  onCaptureReasonCommit: () => void;
}

function RunProgress({
  run,
  headingId,
  onClose,
  onDismiss,
  onReadOverview,
  onCaptureReasonChange,
  onCaptureReasonCommit,
}: RunProgressProps) {
  const surface = useSurface();
  const elapsedSeconds = useElapsedSeconds(run.startedAt, run.finishedAt);
  const isDone = run.overview !== null;
  const analytics = useAnalytics();

  return (
    <>
      <div className={styles.source}>
        {run.video ? (
          <>
            <OverviewThumbnail video={run.video} className={styles.thumbnail} />
            <div className={styles.sourceText}>
              <h2
                className={styles.sourceTitle}
                id={headingId}
                data-testid={newOverviewDialogTestIds.sourceTitle}
              >
                {run.video.title}
              </h2>
              <p className={styles.sourceMeta}>
                {run.video.channel}
                {run.video.durationMs !== null && ` · ${formatClock(run.video.durationMs / 1000)}`}
              </p>
            </div>
          </>
        ) : (
          <div className={styles.sourceText}>
            <h2 className={styles.sourceTitle} id={headingId}>
              New overview
            </h2>
            <p className={styles.sourceMeta}>{run.url}</p>
          </div>
        )}
      </div>

      <GenerationSteps run={run} />

      {/* Design 21a: the field stays through the done state too, so a reason can still
          be added before pressing Read overview. */}
      <CaptureReasonField
        value={run.captureReason}
        onChange={onCaptureReasonChange}
        onCommit={onCaptureReasonCommit}
      />

      <div className={styles.foot}>
        <span className={styles.footText}>
          <span className={styles.elapsed} data-testid={newOverviewDialogTestIds.elapsed}>
            {formatClock(elapsedSeconds)} elapsed
          </span>
          {!isDone && (
            <p className={styles.footNote} data-testid={newOverviewDialogTestIds.footNote}>
              You can close this — it keeps going.
              {surface === "extension" && " Closing the side panel does stop it."}
            </p>
          )}
        </span>
        {isDone ? (
          <span className={styles.footActions}>
            <button
              type="button"
              className={styles.secondaryAction}
              onClick={() => {
                analytics.capture.newOverviewDialog.runDismissed({ run: "ready" });
                onDismiss();
              }}
              data-testid={newOverviewDialogTestIds.closeWhenDoneButton}
            >
              Close
            </button>
            <button
              type="button"
              className={styles.primaryAction}
              onClick={() => {
                analytics.capture.newOverviewDialog.readChosen({ overviewId: run.overview!.id, from: "dialog" });
                onReadOverview(run.overview!);
              }}
              data-testid={newOverviewDialogTestIds.readOverviewButton}
            >
              Read overview
            </button>
          </span>
        ) : (
          <span className={styles.footActions}>
            <button
              type="button"
              className={styles.quietAction}
              onClick={() => {
                analytics.capture.newOverviewDialog.runCancelled();
                onDismiss();
              }}
              data-testid={newOverviewDialogTestIds.cancelRunButton}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.secondaryAction}
              onClick={() => {
                analytics.capture.newOverviewDialog.closed({ run: "running" });
                onClose();
              }}
              data-testid={newOverviewDialogTestIds.runInBackgroundButton}
            >
              Run in background
            </button>
          </span>
        )}
      </div>
    </>
  );
}
