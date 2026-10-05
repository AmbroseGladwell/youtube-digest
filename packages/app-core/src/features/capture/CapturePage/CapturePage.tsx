import { formatClock, timeSavedSummary } from "@overview/domain";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router";
import type { Overview } from "@overview/domain";
import { useActiveVideoUrl } from "../../../app/ActiveVideoContext.js";
import { Routes } from "../../../app/Routes.js";
import { StrokeIcon } from "../../../components/shared/StrokeIcon/StrokeIcon.js";
import { BYO_KEY_NOTE } from "../../apiKeys/byoKeyNote.js";
import { useGenerationReadiness } from "../../newOverview/useGenerationReadiness.js";
import { CaptureReasonField } from "../../newOverview/components/CaptureReasonField/CaptureReasonField.js";
import { GenerationSteps } from "../../newOverview/components/GenerationSteps/GenerationSteps.js";
import { JUST_GENERATED } from "../../newOverview/justGenerated.js";
import { useNewOverviewRunController } from "../../newOverview/NewOverviewRunContext.js";
import type { NewOverviewRun } from "../../newOverview/types/NewOverviewRun.js";
import { useElapsedSeconds } from "../../newOverview/useElapsedSeconds.js";
import { useOverviewsWithStateQuery } from "../../overviews/queries/overviewsWithStateQuery.js";
import { readableEntries } from "../../overviews/types/LibraryEntry.js";
import { MilestoneStack } from "../../timeSaved/components/MilestoneStack/MilestoneStack.js";
import { AccountStrip } from "../../accountLibraries/components/AccountStrip/AccountStrip.js";
import { LibraryMoveNotice } from "../../accountLibraries/components/LibraryMoveNotice/LibraryMoveNotice.js";
import { useLibraryMove } from "../../accountLibraries/LibraryMoveContext.js";
import { OpeningLibrary } from "../../accountLibraries/components/OpeningLibrary/OpeningLibrary.js";
import { useAccountStripKind } from "../../accountLibraries/useAccountStripKind.js";
import { AnalyticsConsentStripSlot } from "../../analyticsConsent/components/AnalyticsConsentStripSlot/AnalyticsConsentStripSlot.js";
import { useAnalyticsConsentStrip } from "../../analyticsConsent/useAnalyticsConsentStrip.js";
import { useSignedOutHere } from "../../accountLibraries/useSignedOutHere.js";
import { useSync } from "../../sync/SyncContext.js";
import { useMilestones } from "../../timeSaved/useMilestones.js";
import { useWatchedTranscriptQuery } from "../../transcripts/queries/watchedTranscriptQuery.js";
import { overviewForVideoUrl } from "../../overviews/util/overviewForVideoUrl.js";
import { useCaptureQueueController } from "../../captureQueue/CaptureQueueContext.js";
import { CaptureQueueStripView } from "../../captureQueue/components/CaptureQueueStripView/CaptureQueueStripView.js";
import styles from "./CapturePage.module.scss";
import { capturePageTestIds } from "./CapturePageTestIds.js";
import { useAnalytics } from "../../analytics/AnalyticsContext.js";

// The side panel's home: one video, the one in front of it (docs/features/extension-panel.md).
// There is no list here and no + New — the whole page is the offer to take this video,
// and it becomes the run's own progress while the run is going.
export function CapturePage() {
  const navigate = useNavigate();
  const activeVideoUrl = useActiveVideoUrl();
  const controller = useNewOverviewRunController();
  const overviewsQuery = useOverviewsWithStateQuery();
  const watchedTranscript = useWatchedTranscriptQuery();
  const keysReady = useGenerationReadiness() === "ready";
  const timeSaved = timeSavedSummary(readableEntries(overviewsQuery.data ?? []));
  const milestones = useMilestones(timeSaved.minutes, overviewsQuery.data !== undefined);
  const heldHere = overviewsQuery.data?.length ?? null;
  const accountStrip = useAccountStripKind(heldHere);
  const consentStrip = useAnalyticsConsentStrip(true);
  const signedOutWithNothingHere = useSignedOutHere() && heldHere === 0;
  const sync = useSync();
  const libraryMoved = useLibraryMove().move !== null;
  const captureQueue = useCaptureQueueController();

  const { run, dismiss } = controller;
  const finished = run?.overview ?? null;

  useEffect(() => {
    if (finished === null) {
      return;
    }
    dismiss();
    void navigate(Routes.overview(finished.id), { replace: true, state: JUST_GENERATED });
  }, [finished, dismiss, navigate]);

  const analytics = useAnalytics();
  const readOverview = (overview: Overview) => {
    analytics.capture.panel.readChosen({ overviewId: overview.id });
    void navigate(Routes.overview(overview.id));
  };

  const createOverview = (again: boolean) => {
    if (activeVideoUrl !== null) {
      analytics.capture.panel.createChosen({ again });
      controller.start(activeVideoUrl, { from: "panel" });
    }
  };

  if (run !== null && run.overview === null) {
    return (
      <div className={styles.root} data-testid={capturePageTestIds.root}>
        <RunInProgress
          run={run}
          onDismiss={dismiss}
          onCaptureReasonChange={controller.setCaptureReason}
          onCaptureReasonCommit={controller.commitCaptureReason}
        />
      </div>
    );
  }

  if (sync.opening) {
    return (
      <div className={styles.root} data-testid={capturePageTestIds.root}>
        <OpeningLibrary panel />
      </div>
    );
  }

  const alreadyHeld = overviewForVideoUrl(overviewsQuery.data ?? [], activeVideoUrl);
  const captionsHeld = !watchedTranscript.isFetching && watchedTranscript.data != null;

  return (
    <div
      className={`${styles.root} ${accountStrip === null && consentStrip === null && !libraryMoved && captureQueue.strip === null ? "" : styles.withStrip}`}
      data-testid={capturePageTestIds.root}
    >
      {captureQueue.strip !== null ? (
        <CaptureQueueStripView
          strip={captureQueue.strip}
          compact
          folded={null}
          onPause={() => captureQueue.setPaused(true)}
          onResume={() => captureQueue.setPaused(false)}
          onDetails={() => undefined}
          onDismiss={captureQueue.dismissStrip}
        />
      ) : libraryMoved ? (
        <LibraryMoveNotice panel />
      ) : consentStrip !== null ? (
        <AnalyticsConsentStripSlot strip={consentStrip} panel />
      ) : (
        accountStrip !== null && <AccountStrip kind={accountStrip} panel />
      )}
      <div className={styles.opening} data-testid={capturePageTestIds.opening}>
        <div>
          <h2 className={styles.title}>
            Watch Less,
            <br />
            with <em className={styles.em}>The Overview</em>
          </h2>
          <p className={styles.standfirst}>
            Get a succinct overview, with the main premise, key points, actionable steps and a
            verdict on if it's worth your time.
          </p>
        </div>

        {alreadyHeld ? (
          <>
            <button
              type="button"
              className={styles.primary}
              onClick={() => readOverview(alreadyHeld)}
              data-testid={capturePageTestIds.readOverviewButton}
            >
              Read overview
            </button>
            <p className={styles.note} data-testid={capturePageTestIds.alreadyInLibraryNote}>
              This video is already in your library.{" "}
              <button
                type="button"
                className={styles.quiet}
                onClick={() => createOverview(true)}
                disabled={!keysReady}
                data-testid={capturePageTestIds.createAgainButton}
              >
                Write a new one
              </button>
            </p>
          </>
        ) : (
          <button
            type="button"
            className={styles.primary}
            onClick={() => createOverview(false)}
            disabled={activeVideoUrl === null || !keysReady}
            data-testid={capturePageTestIds.createButton}
          >
            Create overview
          </button>
        )}

        {activeVideoUrl === null && (
          <p className={styles.note} data-testid={capturePageTestIds.noVideoNote}>
            Visit a YouTube video to start creating an overview.
          </p>
        )}

        {signedOutWithNothingHere && (
          <p className={styles.note} data-testid={capturePageTestIds.signedOutNote}>
            You’re signed out. Your Overviews are safe in your account. Sign in to get them back.
          </p>
        )}

        {activeVideoUrl !== null && alreadyHeld === null && keysReady && (
          <p className={styles.note} data-testid={capturePageTestIds.captionsNote}>
            {watchedTranscript.isFetching
              ? "Fetching its captions now."
              : captionsHeld
                ? "Its captions are already here, so generating won't buy them again."
                : "Fetches the transcript, then writes the overview."}
          </p>
        )}

        <div className={styles.milestones}>
          <MilestoneStack
            milestones={milestones.visible}
            minutes={timeSaved.minutes}
            onLineChosen={milestones.lineChosen}
            onDismiss={milestones.dismiss}
            onUndo={milestones.undo}
          />
        </div>

        {!keysReady && (
          <div className={styles.keys} data-testid={capturePageTestIds.keysNote}>
            <p className={styles.keysLabel}>Your keys</p>
            <p className={styles.note}>{BYO_KEY_NOTE}</p>
            <Link
              className={styles.keysLink}
              to={Routes.settingsSection("keys")}
              onClick={() => analytics.capture.newOverviewForm.keysLinkFollowed({ from: "panel" })}
              data-testid={capturePageTestIds.settingsLink}
            >
              Set up keys in Settings <StrokeIcon name="arrowRight" size={14} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

interface RunInProgressProps {
  run: NewOverviewRun;
  onDismiss: () => void;
  onCaptureReasonChange: (captureReason: string) => void;
  onCaptureReasonCommit: () => void;
}

function RunInProgress({
  run,
  onDismiss,
  onCaptureReasonChange,
  onCaptureReasonCommit,
}: RunInProgressProps) {
  const analytics = useAnalytics();
  const elapsedSeconds = useElapsedSeconds(run.startedAt, run.finishedAt);
  const failed = run.error !== null;

  return (
    <div className={styles.working} data-testid={capturePageTestIds.working}>
      <div>
        <h2 className={styles.workingTitle} data-testid={capturePageTestIds.workingTitle}>
          {run.video?.title ?? "New overview"}
        </h2>
        <p className={styles.workingChannel} data-testid={capturePageTestIds.workingChannel}>
          {run.video?.channel ?? run.url}
        </p>
      </div>

      <span className={styles.rule} aria-hidden="true" />

      <GenerationSteps run={run} />

      {!failed && (
        <CaptureReasonField
          value={run.captureReason}
          onChange={onCaptureReasonChange}
          onCommit={onCaptureReasonCommit}
        />
      )}

      {failed && (
        <p className={styles.error} data-testid={capturePageTestIds.error}>
          {run.error}
        </p>
      )}

      <div className={styles.workingFoot}>
        <span className={styles.elapsed} data-testid={capturePageTestIds.elapsed}>
          {formatClock(elapsedSeconds)} elapsed
        </span>
        {failed ? (
          <button
            type="button"
            className={styles.outlined}
            onClick={() => {
              analytics.capture.newOverviewDialog.runDismissed({ run: "failed" });
              onDismiss();
            }}
            data-testid={capturePageTestIds.startAgainButton}
          >
            Start again
          </button>
        ) : (
          <button
            type="button"
            className={styles.outlined}
            onClick={() => {
              analytics.capture.newOverviewDialog.runCancelled();
              onDismiss();
            }}
            data-testid={capturePageTestIds.cancelButton}
          >
            Cancel
          </button>
        )}
      </div>

      {!failed && (
        <p className={styles.note} data-testid={capturePageTestIds.keepOpenNote}>
          Keep the side panel open until this finishes. Closing it stops the run.
        </p>
      )}
    </div>
  );
}
