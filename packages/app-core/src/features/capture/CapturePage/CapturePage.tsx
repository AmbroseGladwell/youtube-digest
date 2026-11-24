import { KeptHereBanner } from "../../captures/components/KeptHereBanner/KeptHereBanner.js";
import { DEFAULT_PLAN, domainOf, formatClock, timeSavedSummary } from "@overview/domain";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import type { Overview, TranscribeChoice } from "@overview/domain";
import { Routes } from "../../../app/Routes.js";
import { useActiveVideoUrl } from "../../../app/ActiveVideoContext.js";
import { useActivePage, useArticlePages } from "../../../app/ArticlePagesContext.js";
import { isOfferedPage } from "../../../app/isOfferedPage.js";
import { LimitMessageNote } from "../../newOverview/components/LimitMessageNote/LimitMessageNote.js";
import { useLimitMessage } from "../../newOverview/useLimitMessage.js";
import { useNextQuota } from "../../newOverview/useNextQuota.js";
import { useOverviewUsageQuery } from "../../newOverview/queries/overviewUsageQuery.js";
import { resetDate } from "../../newOverview/util/usageLine.js";
import { SoftWall } from "../../newOverview/components/SoftWall/SoftWall.js";
import { PlansModal } from "../../plus/components/PlansModal/PlansModal.js";
import { UsageLine } from "../../newOverview/components/UsageLine/UsageLine.js";
import { RunErrorMessage } from "../../newOverview/components/RunErrorMessage/RunErrorMessage.js";
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
import { SourceOffer } from "../components/SourceOffer/SourceOffer.js";
import { EpisodeOffer, type EpisodeOfferState } from "../components/EpisodeOffer/EpisodeOffer.js";
import { EpisodeNoTranscript } from "../components/EpisodeNoTranscript/EpisodeNoTranscript.js";
import { EpisodeWordsNote } from "../../newOverview/components/PodcastLinkStatus/PodcastLinkStatus.js";
import { createLabelOf, episodeActionOf, transcribeChoiceOf } from "../../podcasts/util/episodeActionOf.js";
import { isPlatformPodcastLink } from "../../newOverview/usePodcastLink.js";
import { useEpisodeTab, type EpisodeTabState } from "../useEpisodeTab.js";
import { useTikTokTab } from "../useTikTokTab.js";
import { TikTokOffer } from "../components/TikTokOffer/TikTokOffer.js";
import { useSocialTab } from "../useSocialTab.js";
import { SocialOffer } from "../components/SocialOffer/SocialOffer.js";
import { isTikTokLink } from "../../newOverview/useTikTokLink.js";
import { isSocialLink } from "../../newOverview/useSocialLink.js";
import { RecentOverviews } from "../components/RecentOverviews/RecentOverviews.js";
import styles from "./CapturePage.module.scss";
import { capturePageTestIds } from "./CapturePageTestIds.js";
import { useAnalytics } from "../../analytics/AnalyticsContext.js";
import { shouldAnimateNavigation } from "../../../util/viewTransitions.js";

const usePageAccess = (url: string | null): boolean | null => {
  const pages = useArticlePages();
  const [known, setKnown] = useState<{ url: string; granted: boolean } | null>(null);
  useEffect(() => {
    if (pages === null || url === null) {
      return;
    }
    let current = true;
    void pages.hasAccess(url).then((granted) => {
      if (current) {
        setKnown({ url, granted });
      }
    });
    return () => {
      current = false;
    };
  }, [pages, url]);
  return known?.url === url ? known.granted : null;
};

const episodeOfferOf = (tab: EpisodeTabState): EpisodeOfferState => {
  if (tab.status === "found") {
    return { status: "found", episode: tab.episode, words: tab.words };
  }
  if (tab.status === "held") {
    return { status: "found", episode: tab.episode, words: null };
  }
  return tab.status === "reading" ? { status: "reading", host: tab.host } : { status: "show" };
};

const captionsNoteText = (fetching: boolean, captionsHeld: boolean): string => {
  if (fetching) {
    return "Fetching its captions now.";
  }
  return captionsHeld
    ? "Its captions are already here, so generating won't buy them again."
    : "Fetches the transcript, then writes the overview.";
};

export const CapturePage = () => {
  const navigate = useNavigate();
  const activeVideoUrl = useActiveVideoUrl();
  const activePage = useActivePage();
  const pages = useArticlePages();
  // Never an article: Spotify or Apple is an episode (106k); TikTok, Instagram and Facebook pages are never read (130i, OV-365).
  const offeredPage =
    activeVideoUrl === null &&
    isOfferedPage(activePage) &&
    !isPlatformPodcastLink(activePage.url) &&
    !isTikTokLink(activePage.url) &&
    !isSocialLink(activePage.url)
      ? activePage
      : null;
  const episodeTab = useEpisodeTab();
  const tiktokTab = useTikTokTab();
  const socialTab = useSocialTab();
  const pageAccess = usePageAccess(offeredPage?.url ?? null);
  const startArticleRun = useStartArticleRun();
  const controller = useNewOverviewRunController();
  const overviewsQuery = useOverviewsWithStateQuery();
  const watchedTranscript = useWatchedTranscriptQuery();
  const readiness = useGenerationReadiness();
  const keysReady = readiness.ready;
  const limit = useLimitMessage();
  const next = useNextQuota();
  const plan = useOverviewUsageQuery().data?.plan ?? DEFAULT_PLAN;
  // At the limit the offer page becomes the wall, so the Overview button never fails silently (327ac).
  const walled = limit !== null && plan !== "plus" && next?.kind === "spent" ? next : null;
  const [plansOpen, setPlansOpen] = useState(false);
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

  // The panel has no "you already have this" dialog: the overview it holds is the answer, so it opens.
  const held = controller.held;
  useEffect(() => {
    if (held === null) {
      return;
    }
    dismiss();
    void navigate(Routes.overview(held.overviewId), { replace: true, state: ALREADY_MADE });
  }, [held, dismiss, navigate]);

  // "Not an article" has no button: going to another page is the way forward, so that clears it.
  const failedOn = run?.article?.failure != null ? run.url : null;
  useEffect(() => {
    if (failedOn !== null && activePage !== null && activePage.url !== failedOn) {
      dismiss();
    }
  }, [failedOn, activePage, dismiss]);

  // Nothing was made or kept, so moving the tab on clears only the run (design 106j).
  const episodeWithoutWords =
    episodeTab !== null && run !== null && run.podcast !== null && run.error?.kind === "podcastNoTranscript" && run.url === episodeTab.url;
  const noWordsOn = run?.podcast != null && run.error?.kind === "podcastNoTranscript" ? run.url : null;
  useEffect(() => {
    if (noWordsOn !== null && activePage !== null && activePage.url !== noWordsOn) {
      dismiss();
    }
  }, [noWordsOn, activePage, dismiss]);

  const analytics = useAnalytics();
  const episodeAction = episodeTab?.status === "found" ? episodeActionOf(episodeTab.words) : null;
  const readOverview = (overviewId: Overview["id"]) => {
    analytics.capture.panel.readChosen({ overviewId });
    void navigate(Routes.overview(overviewId), { viewTransition: shouldAnimateNavigation() });
  };

  // Only a first overview: regenerating belongs with the note, not before someone has read it.
  const createOverview = () => {
    if (activeVideoUrl !== null) {
      analytics.capture.panel.createChosen({ again: false });
      controller.start(activeVideoUrl, { from: "panel" });
    }
    if (offeredPage !== null) {
      analytics.capture.panel.createChosen({ again: false });
      startArticleRun(offeredPage, { from: "panel", willAsk: pageAccess !== true });
    }
    if (episodeTab?.status === "found" && episodeAction?.kind !== "stop" && episodeAction?.kind !== "waiting") {
      analytics.capture.panel.createChosen({ again: false });
      controller.startPodcast({
        episode: episodeTab.episode,
        sharedFrom: episodeTab.url,
        from: "panel",
        transcribe: transcribeChoiceOf(episodeAction),
      });
    }
  };

  const failure = run?.article?.failure ?? null;
  if (run !== null && failure !== null) {
    const copy = articleFailureCopy(failure, run.url);
    const tryAgain = () => {
      if (activePage === null) {
        return;
      }
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
          <SourceOffer source={run.article.site} title={run.article.title} words={null} />
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

  if (run !== null && run.overview === null && !episodeWithoutWords) {
    return (
      <div className={styles.root} data-testid={capturePageTestIds.root}>
        <RunInProgress
          run={run}
          onDismiss={dismiss}
          onCaptureReasonChange={controller.setCaptureReason}
          onCaptureReasonCommit={controller.commitCaptureReason}
          onTranscribe={controller.transcribeAgain}
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
  const tiktokHeldId = tiktokTab?.state.status === "held" ? tiktokTab.state.overviewId : null;
  const socialHeldId = socialTab?.state.status === "held" ? socialTab.state.overviewId : null;
  const heldId = episodeTab?.status === "held" ? episodeTab.overviewId : (tiktokHeldId ?? socialHeldId ?? alreadyHeld?.id ?? null);
  const nothingToTake = activeVideoUrl === null && offeredPage === null && episodeTab === null && tiktokTab === null && socialTab === null;
  // The offer carries its own button, inside the click that asks Chrome for TikTok (130i).
  const tiktokOffered = tiktokTab !== null && heldId === null;
  const socialOffered = socialTab !== null && heldId === null;
  const episodeStopped =
    episodeTab !== null &&
    (episodeWithoutWords || episodeTab.status === "show" || episodeTab.status === "failed" || episodeTab.status === "unreachable");
  const captionsHeld = !watchedTranscript.isFetching && watchedTranscript.data != null;
  // Known before Create: noticing the video fetches its captions anyway (docs/features/watching-detection.md).
  const watchedVideo = activeVideoUrl === null ? null : (watchedTranscript.data ?? null);

  const queueStripOrNotice = () => {
    if (captureQueue.strip !== null) {
      return (
        <CaptureQueueStripView
          strip={captureQueue.strip}
          compact
          onPause={() => captureQueue.setPaused(true)}
          onResume={() => captureQueue.setPaused(false)}
          onDismiss={captureQueue.dismissStrip}
        />
      );
    }
    return libraryMoved ? <LibraryMoveNotice panel /> : null;
  };

  const makeTikTok = () => {
    analytics.capture.panel.createChosen({ again: false });
    tiktokTab?.make((video, words) => {
      if (words !== null) {
        controller.startTikTok({ video, words, from: "panel" });
      }
    });
  };

  const transcribeTikTok = (transcribe: TranscribeChoice) => {
    if (tiktokTab?.state.status === "transcribable") {
      analytics.capture.panel.createChosen({ again: false });
      controller.startTikTok({ video: tiktokTab.state.video, words: null, transcribe, from: "panel" });
    }
  };

  const makeSocial = () => {
    analytics.capture.panel.createChosen({ again: false });
    socialTab?.make((post, words) => controller.startSocial({ post, words, from: "panel" }));
  };

  const transcribeSocial = (transcribe: TranscribeChoice) => {
    if (socialTab?.state.status === "transcribable") {
      analytics.capture.panel.createChosen({ again: false });
      controller.startSocial({ post: socialTab.state.post, words: null, transcribe, from: "panel" });
    }
  };

  const openingOffer = () => {
    if (socialOffered) {
      return <SocialOffer tab={socialTab} ready={keysReady && limit === null} onMake={makeSocial} onTranscribe={transcribeSocial} />;
    }
    if (tiktokOffered) {
      return <TikTokOffer tab={tiktokTab} ready={keysReady && limit === null} onMake={makeTikTok} onTranscribe={transcribeTikTok} />;
    }
    if (episodeTab !== null) {
      if (episodeTab.status === "failed") {
        return <ArticleFailureNotice copy={episodeTab.copy} onWay={episodeTab.retry} />;
      }
      if (episodeTab.status === "unreachable") {
        return (
          <p className={styles.note} role="alert" data-testid={capturePageTestIds.episodeUnreachable}>
            We couldn’t check this episode just now.{" "}
            <button type="button" className={styles.retry} onClick={episodeTab.retry}>
              Try again
            </button>
          </p>
        );
      }
      return <EpisodeOffer on={episodeTab.on} offer={episodeOfferOf(episodeTab)} />;
    }
    if (offeredPage !== null) {
      return <SourceOffer source={domainOf(offeredPage.url)} title={offeredPage.title} />;
    }
    if (watchedVideo !== null) {
      return <SourceOffer source={watchedVideo.channel} title={watchedVideo.title} video />;
    }
    return (
      <div>
        <h2 className={styles.title}>
          Watch Less,
          <br />
          with <em className={styles.em}>The Overview</em>
        </h2>
        <p className={styles.standfirst} data-testid={capturePageTestIds.noVideoNote}>
          Open a YouTube video or an article, and you can make an overview of it here.
        </p>
      </div>
    );
  };

  const nextStep = () => {
    if (heldId !== null) {
      return (
        <>
          <button
            type="button"
            className={styles.primary}
            onClick={() => readOverview(heldId)}
            data-testid={capturePageTestIds.readOverviewButton}
          >
            Read overview
          </button>
          <p className={styles.note} data-testid={capturePageTestIds.alreadyInLibraryNote}>
            Already in your library
          </p>
        </>
      );
    }
    if (episodeWithoutWords) {
      return <EpisodeNoTranscript />;
    }
    if (episodeStopped) {
      return null;
    }
    if (episodeTab?.status === "found" && episodeAction?.kind === "stop") {
      return <EpisodeWordsNote words={episodeTab.words} episodeSeconds={episodeTab.episode.durationSeconds} />;
    }
    if (walled !== null) {
      return (
        <>
          <SoftWall
            link={{
              kicker: null,
              title: episodeTab?.status === "found" ? episodeTab.episode.title : (offeredPage?.title ?? activeVideoUrl ?? "This link"),
            }}
            resetsOn={resetDate(walled.resetsOn, true)}
            offerKey={plan === "free" && !readiness.hasChosenKey}
            onSeePlans={() => {
              analytics.capture.newOverviewForm.plansOpened({ from: "wall" });
              setPlansOpen(true);
            }}
            onFollowed={() => undefined}
          />
          <PlansModal open={plansOpen} plan={plan} onClose={() => setPlansOpen(false)} />
        </>
      );
    }
    if (limit !== null) {
      return <LimitMessageNote message={limit} from="panel" testIds={capturePageTestIds.limitMessage} />;
    }
    return (
      !nothingToTake &&
      !tiktokOffered &&
      !socialOffered && (
        <button
          type="button"
          className={styles.primary}
          onClick={() => createOverview()}
          disabled={!keysReady || episodeTab?.status === "reading" || episodeAction?.kind === "waiting"}
          data-testid={capturePageTestIds.createButton}
        >
          {episodeAction === null ? "Create overview" : createLabelOf(episodeAction, "Create overview")}
        </button>
      )
    );
  };

  return (
    <div
      className={`${styles.root} ${!libraryMoved && captureQueue.strip === null ? "" : styles.withStrip}`}
      data-testid={capturePageTestIds.root}
    >
      {queueStripOrNotice()}
      <KeptHereBanner />
      <div className={styles.opening} data-testid={capturePageTestIds.opening}>
        {openingOffer()}

        {nextStep()}

        {episodeTab?.status === "found" && limit === null && episodeAction?.kind !== "stop" && (
          <EpisodeWordsNote words={episodeTab.words} episodeSeconds={episodeTab.episode.durationSeconds} />
        )}

        {keysReady && limit === null && !episodeStopped && <UsageLine testIds={capturePageTestIds.usageLine} narrow />}

        {offeredPage !== null && heldId === null && keysReady && limit === null && pageAccess === false && (
          <p className={styles.note} data-testid={capturePageTestIds.firstTimeNote}>
            First time on {domainOf(offeredPage.url)}. Chrome will ask once whether we can read this site. We only read a page when you
            press Create.
          </p>
        )}

        {activeVideoUrl !== null && heldId === null && keysReady && limit === null && (
          <p className={styles.note} data-testid={capturePageTestIds.captionsNote}>
            {captionsNoteText(watchedTranscript.isFetching, captionsHeld)}
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
      </div>
    </div>
  );
};

interface RunInProgressProps {
  run: NewOverviewRun;
  onDismiss: () => void;
  onCaptureReasonChange: (captureReason: string) => void;
  onCaptureReasonCommit: () => void;
  onTranscribe: () => void;
}

const RunInProgress = ({ run, onDismiss, onCaptureReasonChange, onCaptureReasonCommit, onTranscribe }: RunInProgressProps) => {
  const analytics = useAnalytics();
  const elapsedSeconds = useElapsedSeconds(run.startedAt, run.finishedAt);
  const failed = run.error !== null;

  return (
    <div className={styles.working} data-testid={capturePageTestIds.working}>
      {run.article !== null ? (
        <SourceOffer source={run.article.site} title={run.article.title} words={run.article.words} recipe={run.article.recipe} />
      ) : (
        <>
          <div>
            <h2 className={styles.workingTitle} data-testid={capturePageTestIds.workingTitle}>
              {run.video?.title ?? run.podcast?.title ?? "New overview"}
            </h2>
            <p className={styles.workingChannel} data-testid={capturePageTestIds.workingChannel}>
              {run.video?.channel ?? (run.podcast === null ? run.url : `${run.podcast.show} · Podcast`)}
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

      {!failed && <CaptureReasonField value={run.captureReason} onChange={onCaptureReasonChange} onCommit={onCaptureReasonCommit} />}

      {run.error !== null && (
        <RunErrorMessage
          error={run.error}
          className={styles.error}
          testId={capturePageTestIds.error}
          testIds={capturePageTestIds.runError}
          episodeSeconds={run.podcast?.durationSeconds ?? run.tiktok?.durationSeconds ?? run.social?.post.durationSeconds ?? null}
          onTranscribe={onTranscribe}
          onNotNow={onDismiss}
        />
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
};
