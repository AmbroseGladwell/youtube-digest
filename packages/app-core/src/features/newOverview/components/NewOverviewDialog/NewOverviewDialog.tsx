import { useEffect, useRef, useState } from "react";
import type { Overview } from "@overview/types";
import { useActiveVideoUrl } from "../../../../app/ActiveVideoContext.js";
import { useSurface } from "../../../../app/SurfaceContext.js";
import { OverviewThumbnail } from "../../../../components/shared/OverviewThumbnail/OverviewThumbnail.js";
import { formatClock } from "../../../../util/formatClock.js";
import type { NewOverviewRun } from "../../types/NewOverviewRun.js";
import { generationRunSteps } from "../../util/generationRunSteps.js";
import { useElapsedSeconds } from "../../useElapsedSeconds.js";
import { GenerateOverviewForm } from "../GenerateOverviewForm/GenerateOverviewForm.js";
import styles from "./NewOverviewDialog.module.scss";
import { newOverviewDialogTestIds } from "./NewOverviewDialogTestIds.js";

export interface NewOverviewDialogProps {
  open: boolean;
  run: NewOverviewRun | null;
  onSubmit: (url: string) => void;
  onClose: () => void;
  onDismiss: () => void;
  onReadOverview: (overview: Overview) => void;
}

const HEADING_ID = "NewOverviewDialog-heading";

const STEP_MARK: Record<string, string> = { done: "✓", running: "●", waiting: "" };

export function NewOverviewDialog({
  open,
  run,
  onSubmit,
  onClose,
  onDismiss,
  onReadOverview,
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
  const requestClose = () => (inProgress ? onClose() : onDismiss());

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
                onClick={onDismiss}
                aria-label="Close"
                data-testid={newOverviewDialogTestIds.closeButton}
              >
                ✕
              </button>
            </div>
            <GenerateOverviewForm
              url={url}
              onUrlChange={setUrl}
              onSubmit={handleSubmit}
              onCancel={onDismiss}
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
}

function RunProgress({ run, headingId, onClose, onDismiss, onReadOverview }: RunProgressProps) {
  const surface = useSurface();
  const elapsedSeconds = useElapsedSeconds(run.startedAt, run.finishedAt);
  const steps = generationRunSteps(run);
  const isDone = run.overview !== null;

  return (
    <>
      <div className={styles.source}>
        {run.video ? (
          <>
            <OverviewThumbnail video={run.video} className={styles.thumbnail} />
            <div className={styles.sourceText}>
              <h2 className={styles.sourceTitle} id={headingId} data-testid={newOverviewDialogTestIds.sourceTitle}>
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

      <span className={styles.rule} aria-hidden="true" />

      <ol className={styles.steps} aria-live="polite" data-testid={newOverviewDialogTestIds.steps}>
        {steps.map((step) => (
          <li
            key={step.number}
            className={styles.step}
            data-testid={newOverviewDialogTestIds.step(step.number)}
            data-state={step.state}
          >
            <span className={styles.stepNumber} aria-hidden="true">
              {step.number}
            </span>
            <span className={styles.stepBody}>
              <span className={styles.stepLabel}>{step.label}</span>
              <span className={styles.stepDetail} data-testid={newOverviewDialogTestIds.stepDetail(step.number)}>
                {step.detail}
              </span>
              <span className={styles.barTrack} aria-hidden="true">
                <span className={styles.barFill} />
              </span>
            </span>
            <span className={styles.stepMark} aria-hidden="true">
              {STEP_MARK[step.state]}
            </span>
          </li>
        ))}
      </ol>

      <div className={styles.foot}>
        {!isDone && (
          <p className={styles.footNote} data-testid={newOverviewDialogTestIds.footNote}>
            You can close this — it keeps going.
            {surface === "extension" && " Closing the side panel does stop it."}
          </p>
        )}
        <div className={styles.footRow}>
          <span className={styles.elapsed} data-testid={newOverviewDialogTestIds.elapsed}>
            {formatClock(elapsedSeconds)} elapsed
          </span>
          {isDone ? (
            <span className={styles.footActions}>
              <button
                type="button"
                className={styles.secondaryAction}
                onClick={onDismiss}
                data-testid={newOverviewDialogTestIds.closeWhenDoneButton}
              >
                Close
              </button>
              <button
                type="button"
                className={styles.primaryAction}
                onClick={() => onReadOverview(run.overview!)}
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
                onClick={onDismiss}
                data-testid={newOverviewDialogTestIds.cancelRunButton}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.secondaryAction}
                onClick={onClose}
                data-testid={newOverviewDialogTestIds.runInBackgroundButton}
              >
                Run in background
              </button>
            </span>
          )}
        </div>
      </div>
    </>
  );
}
