import { useEffect } from "react";
import { Link, useNavigate } from "react-router";
import type { Overview } from "@overview/types";
import { useActiveVideoUrl } from "../../../app/ActiveVideoContext.js";
import { Routes } from "../../../app/Routes.js";
import { hasRequiredApiKeys } from "../../apiKeys/ApiKeys.js";
import { BYO_KEY_NOTE } from "../../apiKeys/byoKeyNote.js";
import { useApiKeys } from "../../apiKeys/useApiKeys.js";
import { GenerationSteps } from "../../newOverview/components/GenerationSteps/GenerationSteps.js";
import { JUST_GENERATED } from "../../newOverview/justGenerated.js";
import { useNewOverviewRunController } from "../../newOverview/NewOverviewRunContext.js";
import type { NewOverviewRun } from "../../newOverview/types/NewOverviewRun.js";
import { useElapsedSeconds } from "../../newOverview/useElapsedSeconds.js";
import { useOverviewsWithStateQuery } from "../../overviews/queries/overviewsWithStateQuery.js";
import { useWatchedTranscriptQuery } from "../../transcripts/queries/watchedTranscriptQuery.js";
import { formatClock } from "../../../util/formatClock.js";
import { overviewForVideoUrl } from "../util/overviewForVideoUrl.js";
import styles from "./CapturePage.module.scss";
import { capturePageTestIds } from "./CapturePageTestIds.js";

// The side panel's home: one video, the one in front of it (docs/features/extension-panel.md).
// There is no list here and no + New — the whole page is the offer to take this video,
// and it becomes the run's own progress while the run is going.
export function CapturePage() {
  const navigate = useNavigate();
  const activeVideoUrl = useActiveVideoUrl();
  const { apiKeys } = useApiKeys();
  const controller = useNewOverviewRunController();
  const overviewsQuery = useOverviewsWithStateQuery();
  const watchedTranscript = useWatchedTranscriptQuery();

  const { run, dismiss } = controller;
  const finished = run?.overview ?? null;

  useEffect(() => {
    if (finished === null) {
      return;
    }
    dismiss();
    void navigate(Routes.overview(finished.id), { replace: true, state: JUST_GENERATED });
  }, [finished, dismiss, navigate]);

  const readOverview = (overview: Overview) => void navigate(Routes.overview(overview.id));

  const createOverview = () => {
    if (activeVideoUrl !== null) {
      controller.start(activeVideoUrl);
    }
  };

  if (run !== null && run.overview === null) {
    return (
      <div className={styles.root} data-testid={capturePageTestIds.root}>
        <RunInProgress run={run} onDismiss={dismiss} />
      </div>
    );
  }

  const keysReady = hasRequiredApiKeys(apiKeys);
  const alreadyHeld = overviewForVideoUrl(overviewsQuery.data ?? [], activeVideoUrl);
  const captionsHeld = !watchedTranscript.isFetching && watchedTranscript.data != null;

  return (
    <div className={styles.root} data-testid={capturePageTestIds.root}>
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
                onClick={createOverview}
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
            onClick={createOverview}
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

        {activeVideoUrl !== null && alreadyHeld === null && keysReady && (
          <p className={styles.note} data-testid={capturePageTestIds.captionsNote}>
            {watchedTranscript.isFetching
              ? "Fetching its captions now."
              : captionsHeld
                ? "Its captions are already here, so generating won't buy them again."
                : "Fetches the transcript, then writes the overview."}
          </p>
        )}

        {!keysReady && (
          <div className={styles.keys} data-testid={capturePageTestIds.keysNote}>
            <p className={styles.keysLabel}>Your keys</p>
            <p className={styles.note}>{BYO_KEY_NOTE}</p>
            <Link
              className={styles.keysLink}
              to={Routes.settings()}
              data-testid={capturePageTestIds.settingsLink}
            >
              Set up keys in Settings →
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
}

function RunInProgress({ run, onDismiss }: RunInProgressProps) {
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
            onClick={onDismiss}
            data-testid={capturePageTestIds.startAgainButton}
          >
            Start again
          </button>
        ) : (
          <button
            type="button"
            className={styles.outlined}
            onClick={onDismiss}
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
