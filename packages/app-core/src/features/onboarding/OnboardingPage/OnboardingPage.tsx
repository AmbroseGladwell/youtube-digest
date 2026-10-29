import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ONBOARDING_STEPS,
  OverviewId,
  sameTopicName,
  STARTER_TOPICS,
  type AuthIntent,
  type OnboardingStep,
  type Overview,
} from "@overview/domain";
import { Routes } from "../../../app/Routes.js";
import { OverviewMark } from "../../../components/shared/OverviewMark/OverviewMark.js";
import { StrokeIcon } from "../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useStores } from "../../../stores/StoresContext.js";
import { useLibraryMove } from "../../accountLibraries/LibraryMoveContext.js";
import { useAnalytics } from "../../analytics/AnalyticsContext.js";
import { answerAnalyticsConsent, useAnalyticsConsent } from "../../analyticsConsent/useAnalyticsConsent.js";
import { useAnalyticsDecline } from "../../analyticsConsent/useAnalyticsDecline.js";
import { consentAnswered } from "../../analyticsConsent/util/consentAllowsSharing.js";
import { RequestLinkFlow } from "../../auth/components/RequestLinkFlow/RequestLinkFlow.js";
import { youTubeLink } from "../../newOverview/util/parseYouTubeUrl.js";
import { useCreateTopicMutation } from "../../overviews/mutations/useCreateTopicMutation.js";
import { useTopicsQuery } from "../../overviews/queries/topicsQuery.js";
import { usePlaylistLookupQuery } from "../../playlists/queries/playlistLookupQuery.js";
import { useUpdateSettingsMutation } from "../../settings/mutations/useUpdateSettingsMutation.js";
import { useSettingsQuery } from "../../settings/queries/settingsQuery.js";
import { libraryAccountIdOf } from "../../sync/types/SyncConnection.js";
import { useSyncConnection } from "../../sync/useSyncConnection.js";
import { OnboardingAboutYou, type AboutYouAnswer } from "../components/OnboardingAboutYou/OnboardingAboutYou.js";
import { OnboardingAccount } from "../components/OnboardingAccount/OnboardingAccount.js";
import { OnboardingAnalytics } from "../components/OnboardingAnalytics/OnboardingAnalytics.js";
import { ONBOARDING_HEADING_ID } from "../components/OnboardingHeading/OnboardingHeading.js";
import { OnboardingPlan } from "../components/OnboardingPlan/OnboardingPlan.js";
import { OnboardingPreview } from "../components/OnboardingPreview/OnboardingPreview.js";
import { OnboardingProgressBar } from "../components/OnboardingProgressBar/OnboardingProgressBar.js";
import { OnboardingSlide } from "../components/OnboardingSlide/OnboardingSlide.js";
import { OnboardingTopics } from "../components/OnboardingTopics/OnboardingTopics.js";
import { OnboardingVideo } from "../components/OnboardingVideo/OnboardingVideo.js";
import { OnboardingVoice } from "../components/OnboardingVoice/OnboardingVoice.js";
import { writeOnboardingProgress, type OnboardingProgress } from "../onboardingProgressStorage.js";
import { writeNextSteps } from "../nextStepsStorage.js";
import { useOnboardingProgress } from "../useOnboardingProgress.js";
import { useOnboardingRun } from "../useOnboardingRun.js";
import styles from "./OnboardingPage.module.scss";
import { onboardingPageTestIds } from "./OnboardingPageTestIds.js";

// Start, the screens here, then the reveal and its next steps: thirteen in the story's
// segments (design 46b's second layer).
const STORY_LENGTH = ONBOARDING_STEPS.length + 3;
const SKIPPABLE: readonly OnboardingStep[] = ["topics", "library", "aboutYou", "voice", "askYourAi", "moreSources"];
const WRITES_AFTER = ONBOARDING_STEPS.indexOf("aboutYou");
const indexOf = (step: OnboardingStep) => ONBOARDING_STEPS.indexOf(step);

// Onboarding inside the first overview (designs 46b–46k): while it's made, the reader answers
// or skips what shapes it, then makes an account, picks a plan and lands on it. Where they are
// is kept on the device, so a reload or the sign-in link in another tab carries on
// (docs/features/onboarding.md).
export function OnboardingPage() {
  const [progress, update] = useOnboardingProgress();
  if (progress === null) return <Navigate to={Routes.home()} replace />;
  return <Onboarding progress={progress} update={update} />;
}

interface OnboardingProps {
  progress: OnboardingProgress;
  update: (patch: Partial<OnboardingProgress> | null) => void;
}

function Onboarding({ progress, update }: OnboardingProps) {
  const navigate = useNavigate();
  const analytics = useAnalytics();
  const { connection } = useSyncConnection();
  const accountId = libraryAccountIdOf(connection);
  const signedIn = accountId !== null;
  const { consent } = useAnalyticsConsent();
  const analyticsAnswered = consentAnswered(consent);
  const declineAnalytics = useAnalyticsDecline();
  const libraryMove = useLibraryMove();
  const { overviewStore } = useStores();
  const createTopic = useCreateTopicMutation();
  const updateSettings = useUpdateSettingsMutation();
  const readerContext = useSettingsQuery().data?.readerContext ?? null;
  const topics = useTopicsQuery().data ?? [];
  const [attempt, setAttempt] = useState(0);
  const [asking, setAsking] = useState<AuthIntent | null>(null);
  const [savingTopics, setSavingTopics] = useState(false);
  const step = progress.step;

  const link = youTubeLink(progress.link);
  const playlist = usePlaylistLookupQuery(link?.kind === "playlist" ? link.playlistId : null);
  const firstVideo = playlist.data?.entries.find((entry) => entry.availability === "available") ?? null;
  useEffect(() => {
    if (progress.videoUrl === null && firstVideo !== null) update({ videoUrl: watchUrl(firstVideo.videoId) });
  }, [progress.videoUrl, firstVideo, update]);

  const run = useOnboardingRun({
    videoUrl: signedIn || progress.overviewId !== null ? null : progress.videoUrl,
    mayWrite: progress.mayWrite,
    attempt,
    onMade: (overview) => update({ overviewId: overview.id }),
  });
  const stored = useQuery({
    queryKey: ["onboarding", "overview", accountId, progress.overviewId],
    queryFn: async () => (progress.overviewId === null ? null : await overviewStore.getOverview(progress.overviewId)),
    enabled: progress.overviewId !== null,
    refetchInterval: (query) => (signedIn && query.state.data == null ? 1000 : false),
  });
  const overview: Overview | null = stored.data ?? run.overview;
  const inAccount = signedIn && stored.data != null;
  const failed = progress.overviewId === null && (run.phase === "failed" || playlist.isError);
  const phase = progress.overviewId !== null ? "ready" : failed ? "failed" : run.phase;

  const go = (next: OnboardingStep) =>
    update({ step: next, ...(indexOf(next) > WRITES_AFTER ? { mayWrite: true } : {}) });
  const next = () => go(ONBOARDING_STEPS[indexOf(step) + 1] ?? "account");
  const startAgain = () => {
    update(null);
    void navigate(Routes.home(), { replace: true });
  };

  const finish = (overviewId: string) => {
    analytics.onboarding.finished.revealed({ way: progress.way ?? "signIn" });
    libraryMove.dismiss();
    writeNextSteps({ overviewId: OverviewId.parse(overviewId), dismissed: [] });
    void navigate(Routes.overview(overviewId), { replace: true });
    writeOnboardingProgress(null);
  };

  useEffect(() => {
    if (step === "analytics" && analyticsAnswered) update({ step: "video" });
  }, [step, analyticsAnswered, update]);

  useEffect(() => {
    if (!signedIn) return;
    if (progress.overviewId === null) {
      update(null);
      void navigate(Routes.home(), { replace: true });
    } else if (progress.way === "createAccount" && step !== "plan") {
      update({ step: "plan", mayWrite: true });
    }
  }, [signedIn, progress.overviewId, progress.way, step, update, navigate]);

  const revealed = useRef(false);
  useEffect(() => {
    if (!inAccount || progress.way === "createAccount" || progress.overviewId === null || revealed.current) return;
    revealed.current = true;
    finish(progress.overviewId);
  });

  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (shown.current === step) return;
    shown.current = step;
    analytics.onboarding.step.shown({ step });
  }, [step, analytics]);

  const heardFailure = useRef(-1);
  useEffect(() => {
    if (phase !== "failed" || heardFailure.current === attempt) return;
    heardFailure.current = attempt;
    analytics.onboarding.overview.failed({ step });
  }, [phase, attempt, step, analytics]);

  const saveTopics = async (chosen: string[]) => {
    setSavingTopics(true);
    try {
      for (const name of chosen) {
        if (topics.some((topic) => sameTopicName(topic.name, name))) continue;
        const starter = STARTER_TOPICS.find((topic) => sameTopicName(topic.name, name));
        await createTopic.mutateAsync(
          starter === undefined ? { name, overviews: [] } : { name: starter.name, description: starter.description, overviews: [] },
        );
      }
    } finally {
      setSavingTopics(false);
    }
    analytics.onboarding.topics.continued({
      picked: chosen.filter((name) => STARTER_TOPICS.some((topic) => sameTopicName(topic.name, name))).length,
      typed: chosen.filter((name) => !STARTER_TOPICS.some((topic) => sameTopicName(topic.name, name))).length,
    });
    update({ topics: chosen });
    next();
  };

  const saveAboutYou = async (answer: AboutYouAnswer) => {
    await updateSettings.mutateAsync({ readerContext: answer.readerContext });
    analytics.onboarding.aboutYou.continued({ role: answer.role, goals: answer.goals, ownWords: answer.ownWords });
    next();
  };

  const progressBar = (
    <OnboardingProgressBar
      phase={phase}
      onSeeOverview={() => {
        analytics.onboarding.overview.seenEarly({ step });
        go("account");
      }}
    />
  );

  const sortedInto =
    overview === null
      ? null
      : overview.topicIds.flatMap((topicId) => topics.find((topic) => topic.id === topicId)?.name ?? []);

  const screen = (() => {
    switch (step) {
      case "analytics":
        return (
          <OnboardingAnalytics
            onAllow={() => {
              answerAnalyticsConsent("share");
              analytics.analyticsConsent.prompt.accepted({ asked: "onboarding" });
              next();
            }}
            onNoThanks={() => {
              declineAnalytics();
              next();
            }}
          />
        );
      case "video":
        return (
          <OnboardingVideo
            video={run.video ?? overview?.video ?? null}
            playlist={playlist.data ?? null}
            failed={failed}
            onLooksRight={next}
            onDifferentLink={() => {
              analytics.onboarding.video.differentLinkChosen();
              startAgain();
            }}
            onChooseVideo={(videoId) => {
              analytics.onboarding.video.differentVideoChosen();
              update({ videoUrl: watchUrl(videoId), overviewId: null });
            }}
          />
        );
      case "topics":
        return <OnboardingTopics chosen={progress.topics} saving={savingTopics} onContinue={(chosen) => void saveTopics(chosen)} />;
      case "aboutYou":
        return (
          <OnboardingAboutYou
            readerContext={readerContext}
            saving={updateSettings.isPending}
            onContinue={(answer) => void saveAboutYou(answer)}
          />
        );
      case "voice":
        return <OnboardingVoice onContinue={next} />;
      case "library":
      case "askYourAi":
      case "moreSources":
        return <OnboardingSlide slide={step} topics={progress.topics} onNext={next} />;
      case "account":
        return (
          <OnboardingAccount
            overview={overview}
            failed={failed}
            onTryAgain={() => {
              analytics.onboarding.overview.retried();
              setAttempt((current) => current + 1);
            }}
            onChoose={(way) => {
              analytics.onboarding.account.chosen({ way });
              update({ way });
              setAsking(way);
            }}
          />
        );
      case "plan":
        return (
          <OnboardingPlan
            inAccount={inAccount}
            onFree={() => {
              analytics.onboarding.plan.chosen({ plan: "free" });
              if (progress.overviewId !== null) finish(progress.overviewId);
            }}
          />
        );
    }
  })();

  const position = indexOf(step) + 2;
  const back = () => {
    analytics.onboarding.step.backChosen({ step });
    const before = ONBOARDING_STEPS[indexOf(step) - 1];
    if (before === undefined || (before === "analytics" && analyticsAnswered)) startAgain();
    else update({ step: before });
  };

  return (
    <div className={styles.root} data-testid={onboardingPageTestIds.root}>
      <header className={styles.top}>
        <Link className={styles.brand} to={Routes.home()}>
          <OverviewMark />
          <span className={styles.brandName}>The Overview</span>
        </Link>
      </header>

      <div className={styles.layout}>
        <main className={styles.main} aria-labelledby={ONBOARDING_HEADING_ID}>
          <div className={styles.narrowProgress}>{progressBar}</div>
          {asking === null || signedIn ? (
            <>
              <div className={styles.nav}>
                {step !== "plan" && (
                  <button
                    type="button"
                    className={styles.back}
                    aria-label="Back"
                    onClick={back}
                    data-testid={onboardingPageTestIds.back}
                  >
                    <StrokeIcon name="arrowLeft" size={18} />
                  </button>
                )}
                <span className={styles.segments} aria-hidden="true" data-testid={onboardingPageTestIds.segments}>
                  {Array.from({ length: STORY_LENGTH }, (_, index) => (
                    <span key={index} className={index < position ? styles.segmentDone : styles.segment} />
                  ))}
                </span>
                <span className={styles.visuallyHidden}>
                  Screen {position} of {STORY_LENGTH}
                </span>
                {SKIPPABLE.includes(step) && (
                  <button
                    type="button"
                    className={styles.skip}
                    onClick={() => {
                      analytics.onboarding.step.skipped({ step });
                      next();
                    }}
                    data-testid={onboardingPageTestIds.skip}
                  >
                    Skip
                  </button>
                )}
              </div>
              {screen}
            </>
          ) : (
            <div className={styles.asking}>
              <button
                type="button"
                className={styles.backFromAccount}
                onClick={() => setAsking(null)}
                data-testid={onboardingPageTestIds.backFromAccount}
              >
                <StrokeIcon name="arrowLeft" size={16} />
                Back to your overview
              </button>
              <RequestLinkFlow intent={asking} />
            </div>
          )}
        </main>

        <div className={styles.wide}>
          <OnboardingPreview progress={progressBar} phase={phase} video={run.video ?? overview?.video ?? null} sortedInto={phase === "ready" ? sortedInto : null} />
        </div>
      </div>
    </div>
  );
}

const watchUrl = (videoId: string) => `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
