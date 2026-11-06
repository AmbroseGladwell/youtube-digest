import { domainOf, formatClock, timeSavedSummary } from "@overview/domain";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import type { Overview } from "@overview/domain";
import { Routes } from "../../../app/Routes.js";
import { useActiveVideoUrl } from "../../../app/ActiveVideoContext.js";
import { useActivePage, useArticlePages, type ActivePage } from "../../../app/ArticlePagesContext.js";
import { BYO_KEY_NOTE } from "../../apiKeys/byoKeyNote.js";
import { LimitMessageNote } from "../../newOverview/components/LimitMessageNote/LimitMessageNote.js";
import { useLimitMessage } from "../../newOverview/useLimitMessage.js";
import { UsageLine } from "../../newOverview/components/UsageLine/UsageLine.js";
import { KeyPromptNote } from "../../apiKeys/components/KeyPromptNote/KeyPromptNote.js";
import { useGenerationReadiness } from "../../newOverview/useGenerationReadiness.js";
import { CaptureReasonField } from "../../newOverview/components/CaptureReasonField/CaptureReasonField.js";
import { GenerationSteps } from "../../newOverview/components/GenerationSteps/GenerationSteps.js";
import { ALREADY_MADE, JUST_GENERATED } from "../../newOverview/justGenerated.js";
import { useStartArticleRun } from "../../newOverview/useStartArticleRun.js";
import { articleFailureCopy } from "../../newOverview/util/articleFailureCopy.js";
import { useNewOverviewRunController } from "../../newOverview/NewOverviewRunContext.js";
import type { NewOverviewRun } from "../../newOverview/types/NewOverviewRun.js";
import { useElapsedSeconds } from "../../newOverview/useElapsedSeconds.js";
import { useOverviewsWithStateQuery } from "../../overviews/queries/overviewsWithStateQuery.js";
import { readableEntries } from "../../overviews/types/LibraryEntry.js";
import { MilestoneStack } from "../../timeSaved/components/MilestoneStack/MilestoneStack.js";
import { LibraryMoveNotice } from "../../accountLibraries/components/LibraryMoveNotice/LibraryMoveNotice.js";
import { useLibraryMove } from "../../accountLibraries/LibraryMoveContext.js";
import { OpeningLibrary } from "../../accountLibraries/components/OpeningLibrary/OpeningLibrary.js";
import { useSync } from "../../sync/SyncContext.js";
import { useMilestones } from "../../timeSaved/useMilestones.js";
import { useWatchedTranscriptQuery } from "../../transcripts/queries/watchedTranscriptQuery.js";
import { overviewForPageUrl, overviewForVideoUrl } from "../../overviews/util/overviewForVideoUrl.js";
import { useCaptureQueueController } from "../../captureQueue/CaptureQueueContext.js";
import { CaptureQueueStripView } from "../../captureQueue/components/CaptureQueueStripView/CaptureQueueStripView.js";
import { ArticleFailureNotice } from "../components/ArticleFailureNotice/ArticleFailureNotice.js";
import { ArticleOffer } from "../components/ArticleOffer/ArticleOffer.js";
import { RecentOverviews } from "../components/RecentOverviews/RecentOverviews.js";
import styles from "./CapturePage.module.scss";
import { capturePageTestIds } from "./CapturePageTestIds.js";
import { useAnalytics } from "../../analytics/AnalyticsContext.js";
import { shouldAnimateNavigation } from "../../../util/viewTransitions.js";

// A site's front page is a list of other stories. We can't look before Create, so its address
// is what tells us; anything subtler is found out by reading (design 77ak).
const isOfferedPage = (page: ActivePage | null): page is ActivePage => page !== null && new URL(page.url).pathname !== "/";

function usePageAccess(url: string | null): boolean | null {
  const pages = useArticlePages();
  const [known, setKnown] = useState<{ url: string; granted: boolean } | null>(null);
  useEffect(() => {
    if (pages === null || url === null) return;
    let current = true;
    void pages.hasAccess(url).then((granted) => {
      if (current) setKnown({ url, granted });
    });
    return () => {
      current = false;
    };
  }, [pages, url]);
  return known?.url === url ? known.granted : null;
}

// The side panel's home: the video or article in front of it (docs/features/extension-panel.md,
// docs/features/article-panel.md). There is no + New: the page is the offer to take what's
// beside it, and it becomes the run's own progress while the run is going.
export function CapturePage() {
  const navigate = useNavigate();
  const activeVideoUrl = useActiveVideoUrl();
  const activePage = useActivePage();
  const pages = useArticlePages();
  const offeredPage = activeVideoUrl === null && isOfferedPage(activePage) ? activePage : null;
  const pageAccess = usePageAccess(offeredPage?.url ?? null);
  const startArticleRun = useStartArticleRun();
  const controller = useNewOverviewRunController();
  const overviewsQuery = useOverviewsWithStateQuery();
  const watchedTranscript = useWatchedTranscriptQuery();
  const readiness = useGenerationReadiness();
  const keysReady = readiness.ready;
  const limit = useLimitMessage();
  const timeSaved = timeSavedSummary(readableEntries(overviewsQuery.data ?? []));
  const milestones = useMilestones(timeSaved.minutes, overviewsQuery.data !== undefined);
  const sync = useSync();
  const libraryMoved = useLibraryMove().move !== null;
  const captureQueue = useCaptureQueueController();

  const { run, dismiss } = controller;
  const finished = run?.overview ?? null;

  const oneTimeUrl = run?.article?.oneTimeAccess === true ? run.url : null;
  useEffect(() => {
    if (finished === null) {
      return;
    }
    const land = (oneTimeAccessHost: string | null) => {
      dismiss();
      void navigate(Routes.overview(finished.id), { replace: true, state: { ...JUST_GENERATED, oneTimeAccessHost } });
    };
    if (oneTimeUrl === null || pages === null) {
      land(null);
      return;
    }
    void pages.hasAccess(oneTimeUrl).then((granted) => land(granted ? null : domainOf(oneTimeUrl)));
  }, [finished, oneTimeUrl, pages, dismiss, navigate]);

  // The panel has no dialog to say "you already have this" in: the overview it holds is
  // the answer, so it opens (docs/features/one-overview-per-video.md, "Prevention").
  const held = controller.held;
  useEffect(() => {
    if (held === null) {
      return;
    }
    dismiss();
    void navigate(Routes.overview(held.overviewId), { replace: true, state: ALREADY_MADE });
  }, [held, dismiss, navigate]);

  // A failure belongs to the page it happened on, and "not an article" has no button: going
  // to another page is the way forward, so that is what clears it.
  const failedOn = run?.article?.failure != null ? run.url : null;
  useEffect(() => {
    if (failedOn !== null && activePage !== null && activePage.url !== failedOn) dismiss();
  }, [failedOn, activePage, dismiss]);

  const analytics = useAnalytics();
  const readOverview = (overview: Overview) => {
    analytics.capture.panel.readChosen({ overviewId: overview.id });
    void navigate(Routes.overview(overview.id), { viewTransition: shouldAnimateNavigation() });
  };

  // Only ever a first overview. Writing a second over one already held was offered here and
  // never worked for a video: the run carried no overview id, so the server refused it under
  // the one-per-video rule and the client folded onto the note already there. Regenerating
  // belongs with the note being regenerated, not in front of someone who has not read it.
  const createOverview = () => {
    if (activeVideoUrl !== null) {
      analytics.capture.panel.createChosen({ again: false });
      controller.start(activeVideoUrl, { from: "panel" });
    }
    if (offeredPage !== null) {
      analytics.capture.panel.createChosen({ again: false });
      startArticleRun(offeredPage, { from: "panel", willAsk: pageAccess !== true });
    }
  };

  const failure = run?.article?.failure ?? null;
  if (run !== null && failure !== null) {
    const copy = articleFailureCopy(failure, run.url);
    const tryAgain = () => {
      if (activePage === null) return;
      if (copy.way === "reload") {
        void pages?.reload(activePage.tabId).then(() => startArticleRun(activePage, { from: "panel", accessInHand: true }));
        return;
      }
      startArticleRun(activePage, { from: "panel", willAsk: copy.way === "askAgain" });
    };
    return (
      <div className={styles.root} data-testid={capturePageTestIds.root}>
        <ArticleFailureNotice copy={copy} onWay={tryAgain} />
      </div>
    );
  }

  if (run?.article?.asking === true) {
    return (
      <div className={styles.root} data-testid={capturePageTestIds.root}>
        <div className={styles.opening}>
          <ArticleOffer site={run.article.site} title={run.article.title} words={null} />
          <button type="button" className={styles.primary} disabled data-testid={capturePageTestIds.createButton}>
            Create overview
          </button>
          <p className={styles.askingNote} data-testid={capturePageTestIds.askingNote}>
            Choose Allow in Chrome’s box to carry on.
          </p>
        </div>
      </div>
    );
  }

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

  const alreadyHeld =
    offeredPage === null
      ? overviewForVideoUrl(overviewsQuery.data ?? [], activeVideoUrl)
      : overviewForPageUrl(overviewsQuery.data ?? [], offeredPage.url);
  const nothingToTake = activeVideoUrl === null && offeredPage === null;
  const captionsHeld = !watchedTranscript.isFetching && watchedTranscript.data != null;

  return (
    <div
      className={`${styles.root} ${!libraryMoved && captureQueue.strip === null ? "" : styles.withStrip}`}
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
      ) : null}
      <div className={styles.opening} data-testid={capturePageTestIds.opening}>
        {offeredPage !== null ? (
          <ArticleOffer site={domainOf(offeredPage.url)} title={offeredPage.title} words={null} />
        ) : (
          <div>
            <h2 className={styles.title}>
              Watch Less,
              <br />
              with <em className={styles.em}>The Overview</em>
            </h2>
            {nothingToTake ? (
              <p className={styles.standfirst} data-testid={capturePageTestIds.noVideoNote}>
                Open a YouTube video or an article, and you can make an overview of it here.
              </p>
            ) : (
              <p className={styles.standfirst}>
                Get a succinct overview, with the main premise, key points, actionable steps and a
                verdict on if it's worth your time.
              </p>
            )}
          </div>
        )}

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
              This {offeredPage === null ? "video" : "article"} is already in your library.
            </p>
          </>
        ) : limit !== null ? (
          <LimitMessageNote message={limit} from="panel" testIds={capturePageTestIds.limitMessage} />
        ) : (
          !nothingToTake && (
            <button
              type="button"
              className={styles.primary}
              onClick={() => createOverview()}
              disabled={!keysReady}
              data-testid={capturePageTestIds.createButton}
            >
              Create overview
            </button>
          )
        )}

        {keysReady && limit === null && <UsageLine testIds={capturePageTestIds.usageLine} narrow />}

        {offeredPage !== null && alreadyHeld === null && keysReady && limit === null && pageAccess === false && (
          <p className={styles.note} data-testid={capturePageTestIds.firstTimeNote}>
            First time on {domainOf(offeredPage.url)}. Chrome will ask once whether we can read this site. We only read a page
            when you press Create.
          </p>
        )}

        {activeVideoUrl !== null && alreadyHeld === null && keysReady && limit === null && (
          <p className={styles.note} data-testid={capturePageTestIds.captionsNote}>
            {watchedTranscript.isFetching
              ? "Fetching its captions now."
              : captionsHeld
                ? "Its captions are already here, so generating won't buy them again."
                : "Fetches the transcript, then writes the overview."}
          </p>
        )}

        {nothingToTake && <RecentOverviews entries={overviewsQuery.data ?? []} />}

        <div className={styles.milestones}>
          <MilestoneStack
            milestones={milestones.visible}
            minutes={timeSaved.minutes}
            onLineChosen={milestones.lineChosen}
            onDismiss={milestones.dismiss}
            onUndo={milestones.undo}
          />
        </div>

        {!keysReady && limit === null && (
          <div className={styles.keys} data-testid={capturePageTestIds.keysNote}>
            <KeyPromptNote testIds={capturePageTestIds.keyPrompt} readiness={readiness} detail={BYO_KEY_NOTE} from="panel" />
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
      {run.article !== null ? (
        <ArticleOffer site={run.article.site} title={run.article.title} words={run.article.words} recipe={run.article.recipe} />
      ) : (
        <>
          <div>
            <h2 className={styles.workingTitle} data-testid={capturePageTestIds.workingTitle}>
              {run.video?.title ?? "New overview"}
            </h2>
            <p className={styles.workingChannel} data-testid={capturePageTestIds.workingChannel}>
              {run.video?.channel ?? run.url}
            </p>
          </div>

          <span className={styles.rule} aria-hidden="true" />
        </>
      )}

      {run.article?.regenerating === true && (
        <p className={styles.note} data-testid={capturePageTestIds.regeneratingNote}>
          Reading the article again
        </p>
      )}

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
