import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  aboutYouIsEmpty,
  aboutYouPatch,
  DEFAULT_NARRATION_VOICE,
  EMPTY_ABOUT_YOU,
  narrationVoiceName,
  ONBOARDING_STEPS,
  OverviewId,
  sameTopicName,
  sourceKey,
  SourceKey,
  STARTER_TOPICS,
  suggestStarterTopics,
  type AboutYou,
  type AuthIntent,
  type OnboardingStep,
  type Overview,
} from "@overview/domain";
import { Routes } from "../../../app/Routes.js";
import { OverviewMark } from "../../../components/shared/OverviewMark/OverviewMark.js";
import { StrokeIcon } from "../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useLibraryAccountId } from "../../../stores/LibraryAccountContext.js";
import { useStores } from "../../../stores/StoresContext.js";
import { useLibraryMove } from "../../accountLibraries/LibraryMoveContext.js";
import { useAnalytics } from "../../analytics/AnalyticsContext.js";
import { answerAnalyticsConsent, useAnalyticsConsent } from "../../analyticsConsent/useAnalyticsConsent.js";
import { useAnalyticsDecline } from "../../analyticsConsent/useAnalyticsDecline.js";
import { consentAnswered } from "../../analyticsConsent/util/consentAllowsSharing.js";
import { RequestLinkFlow } from "../../auth/components/RequestLinkFlow/RequestLinkFlow.js";
import { youTubeLink } from "../../newOverview/util/parseYouTubeUrl.js";
import { useSaveFromShare } from "../../sharedPage/useSaveFromShare.js";
import { savedFromShare } from "../../sharedPage/util/savedFromShare.js";
import { useCreateTopicMutation } from "../../overviews/mutations/useCreateTopicMutation.js";
import { useTopicsQuery } from "../../overviews/queries/topicsQuery.js";
import { usePlaylistLookupQuery } from "../../playlists/queries/playlistLookupQuery.js";
import { useUpdateSettingsMutation } from "../../settings/mutations/useUpdateSettingsMutation.js";
import { useSettingsQuery } from "../../settings/queries/settingsQuery.js";
import { typedEntryCount } from "../../settings/util/aboutYouCopy.js";
import { libraryAccountIdOf } from "../../sync/types/SyncConnection.js";
import { useSyncConnection } from "../../sync/useSyncConnection.js";
import { OnboardingAboutYou } from "../components/OnboardingAboutYou/OnboardingAboutYou.js";
import { OnboardingAccount } from "../components/OnboardingAccount/OnboardingAccount.js";
import { OnboardingAnalytics } from "../components/OnboardingAnalytics/OnboardingAnalytics.js";
import { ONBOARDING_HEADING_ID } from "../components/OnboardingHeading/OnboardingHeading.js";
import { OnboardingPlan } from "../components/OnboardingPlan/OnboardingPlan.js";
import { OnboardingPreview } from "../components/OnboardingPreview/OnboardingPreview.js";
import { OnboardingProgressBar } from "../components/OnboardingProgressBar/OnboardingProgressBar.js";
import { OnboardingSlide } from "../components/OnboardingSlide/OnboardingSlide.js";
import { OnboardingStepsForYou } from "../components/OnboardingStepsForYou/OnboardingStepsForYou.js";
import { OnboardingTopics, type OnboardingTopicSuggestions } from "../components/OnboardingTopics/OnboardingTopics.js";
import { useTopicSuggestions } from "../useTopicSuggestions.js";
import { OnboardingVideo } from "../components/OnboardingVideo/OnboardingVideo.js";
import { OnboardingVoice } from "../components/OnboardingVoice/OnboardingVoice.js";
import { writeOnboardingProgress, type OnboardingProgress } from "../onboardingProgressStorage.js";
import { writeNextSteps } from "../nextStepsStorage.js";
import { useOnboardingProgress } from "../useOnboardingProgress.js";
import { useOnboardingRun } from "../useOnboardingRun.js";
import { foundIn, onboardingSourceOf, onboardingSources } from "../onboardingSources.js";
import { onboardingFailureCopy } from "../util/onboardingFailureCopy.js";
import { OnboardingReadFailure } from "../components/OnboardingReadFailure/OnboardingReadFailure.js";
import { OnboardingTeaser } from "../components/OnboardingTeaser/OnboardingTeaser.js";
import { useSurface } from "../../../app/SurfaceContext.js";
import { useIsPhone } from "../../../util/useIsPhone.js";
import { useMediaQuery } from "../../../util/useMediaQuery.js";
import styles from "./OnboardingPage.module.scss";
import { onboardingPageTestIds } from "./OnboardingPageTestIds.js";

const SKIPPABLE: readonly OnboardingStep[] = ["topics", "library", "aboutYou", "stepsForYou", "voice", "askYourAi", "moreSources"];
// A copy saved from a shared page is already made, so there is nothing to check.
const FROM_SHARE_STEPS = ONBOARDING_STEPS.filter((step) => step !== "video");

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
  const settings = useSettingsQuery().data;
  const aboutYou = settings?.aboutYou ?? EMPTY_ABOUT_YOU;
  const topics = useTopicsQuery().data ?? [];
  const [attempt, setAttempt] = useState(0);
  const [asking, setAsking] = useState<AuthIntent | null>(null);
  const [savingTopics, setSavingTopics] = useState(false);
  const [picking, setPicking] = useState<readonly string[] | null>(null);
  const step = progress.step;
  const share = progress.share;
  const sample = share?.sample ?? false;
  const steps = share === null ? ONBOARDING_STEPS : FROM_SHARE_STEPS;
  const indexOf = (of: OnboardingStep) => steps.indexOf(of);
  // Start, the screens here, then the reveal and its next steps: in the story's segments
  // (design 46b's second layer).
  const storyLength = steps.length + 3;
  const sharedCopy = useMemo(() => (share === null ? null : savedFromShare(share.snapshot.note)), [share]);
  const saveFromShare = useSaveFromShare();
  const openLibraryAccountId = useLibraryAccountId();

  const recognised = useMemo(() => onboardingSourceOf(progress.link), [progress.link]);
  const kind = recognised?.source ?? null;
  const link = youTubeLink(progress.link);
  const playlist = usePlaylistLookupQuery(link?.kind === "playlist" ? link.playlistId : null);
  const firstVideo = playlist.data?.entries.find((entry) => entry.availability === "available") ?? null;
  useEffect(() => {
    if (progress.sourceKey === null && firstVideo !== null) update({ sourceKey: SourceKey.parse(firstVideo.videoId) });
  }, [progress.sourceKey, firstVideo, update]);

  const run = useOnboardingRun({
    source: kind,
    target: signedIn || progress.overviewId !== null || kind === null ? null : kind.target(progress),
    tabId: progress.tabId,
    mayWrite: progress.mayWrite,
    attempt,
    onFound: (found) => {
      if (progress.sourceKey === null) update({ sourceKey: sourceKey(found.source) });
    },
    onMade: (overview) => update({ overviewId: overview.id }),
  });
  const stored = useQuery({
    queryKey: ["onboarding", "overview", accountId, progress.overviewId],
    queryFn: async () => (progress.overviewId === null ? null : await overviewStore.getOverview(progress.overviewId)),
    enabled: progress.overviewId !== null,
    refetchInterval: (query) => (signedIn && query.state.data == null ? 1000 : false),
  });
  const overview: Overview | null = stored.data ?? run.overview ?? sharedCopy;
  const found = run.found ?? (overview === null ? null : foundIn(overview));
  const asked = useTopicSuggestions(found, kind, share === null && !signedIn);
  const offered = useMemo((): OnboardingTopicSuggestions | null => {
    if (found === null || kind === null) return null;
    const noun = kind.noun("video", found);
    return asked.status === "answered"
      ? { noun, names: asked.result.starter, newTopic: asked.result.newTopic, by: "model" }
      : {
          noun,
          names: suggestStarterTopics(found.source.title, found.about),
          newTopic: null,
          by: asked.status === "failed" ? "code-failed" : asked.status === "pending" ? "code-pending" : "code-only",
        };
  }, [found, kind, asked]);
  // Held once the topics screen shows them, so a late answer never moves chips under the reader.
  const [held, setHeld] = useState<OnboardingTopicSuggestions | null>(null);
  useEffect(() => {
    setHeld((current) => (step !== "topics" ? null : (current ?? offered)));
  }, [step, offered]);
  const suggestions = step === "topics" ? (held ?? offered) : offered;
  const inAccount = signedIn && stored.data != null;
  const failed = progress.overviewId === null && (run.phase === "failed" || playlist.isError);
  const phase = progress.overviewId !== null ? "ready" : failed ? "failed" : run.phase;
  const wide = useMediaQuery("(min-width: 64rem)");
  const surface = useSurface();
  const phone = useIsPhone();
  // A page that couldn't be read, or reads the trial can't spend, is shown at the confirm step
  // with a field for another link (154l–154n); a video's failure keeps its own words.
  const readFailure =
    phase === "failed" && run.found === null && run.failure !== null && (run.failure.kind !== "other" || kind === onboardingSources.web)
      ? run.failure
      : null;

  const anotherLink = (link: string): boolean => {
    const another = onboardingSourceOf(link);
    if (another === null) {
      analytics.onboarding.start.linkRefused();
      return false;
    }
    analytics.onboarding.start.linkSubmitted({ kind: another.linkKind });
    update({ link: link.trim(), sourceKey: another.source.keyFromLink(link), tabId: null, overviewId: null });
    setAttempt((current) => current + 1);
    return true;
  };

  const go = (next: OnboardingStep) =>
    update({ step: next, ...(indexOf(next) > indexOf("stepsForYou") ? { mayWrite: true } : {}) });
  const next = () => go(steps[indexOf(step) + 1] ?? "account");
  // From a shared page, leaving the questions goes back to the page. It's a full load, since
  // the copy is read from the document the server writes (docs/features/sharing.md). A sample
  // came from Start, so it goes back there.
  const startAgain = () => {
    update(null);
    if (share === null || share.sample) void navigate(Routes.home(), { replace: true });
    else globalThis.location.assign(Routes.sharedOverview(share.token));
  };

  const finish = (overviewId: string) => {
    analytics.onboarding.finished.revealed({
      way: progress.way ?? "signIn",
      from: share === null ? "link" : share.sample ? "sample" : "share",
    });
    libraryMove.dismiss();
    writeNextSteps({ overviewId: OverviewId.parse(overviewId), dismissed: [], forAnyone: null, sample });
    void navigate(Routes.overview(overviewId), { replace: true });
    writeOnboardingProgress(null);
  };

  const afterAnalytics = steps[indexOf("analytics") + 1] ?? "account";
  useEffect(() => {
    if (step === "analytics" && analyticsAnswered) update({ step: afterAnalytics });
  }, [step, analyticsAnswered, afterAnalytics, update]);

  // Signed in to an account that already holds the copy, it's left as it is, with the
  // reader's own reason and topics. A sample waits for the topics picked here to reach the
  // account, since it's sorted into them.
  const savingShare = useRef(false);
  const { refetch: refetchStored } = stored;
  const answersIn = libraryMove.answersIn === accountId;
  useEffect(() => {
    if (share === null || !signedIn || openLibraryAccountId !== accountId || inAccount || savingShare.current) return;
    if (share.sample && !answersIn) return;
    savingShare.current = true;
    void (async () => {
      if ((await overviewStore.getOverview(share.snapshot.note.id)) === null) {
        await saveFromShare(share.token, share.snapshot, { sample: share.sample });
      }
      await refetchStored();
    })().finally(() => {
      savingShare.current = false;
    });
  }, [share, signedIn, openLibraryAccountId, accountId, inAccount, answersIn, overviewStore, saveFromShare, refetchStored]);

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
    const suggested = [...(suggestions?.names ?? []), ...(suggestions?.newTopic ? [suggestions.newTopic] : [])];
    analytics.onboarding.topics.continued({
      suggestedBy: suggested.length === 0 ? "none" : (suggestions?.by ?? "none"),
      picked: chosen.filter((name) => STARTER_TOPICS.some((topic) => sameTopicName(topic.name, name))).length,
      typed: chosen.filter((name) => !STARTER_TOPICS.some((topic) => sameTopicName(topic.name, name))).length,
      suggested: suggested.length,
      pickedSuggested: chosen.filter((name) => suggested.some((offered) => sameTopicName(offered, name))).length,
    });
    update({ topics: chosen });
    setPicking(null);
    next();
  };

  const saveAboutYou = async (answer: AboutYou) => {
    await updateSettings.mutateAsync(aboutYouPatch(answer));
    analytics.onboarding.aboutYou.continued({
      who: answer.who.length,
      time: answer.time.length,
      focus: answer.focus.length,
      typed: typedEntryCount(answer, progress.topics),
    });
    update({ step: "stepsForYou", mayWrite: !aboutYouIsEmpty(answer) });
  };

  const personal = !aboutYouIsEmpty(aboutYou);
  // The Continue that lets writing go: About you, or the slide after it when the sentence is empty.
  const soon = step === "aboutYou" || (step === "stepsForYou" && !progress.mayWrite);
  const tryAgain = (from: "preview" | "account" | "readFailure") => {
    analytics.onboarding.overview.retried({ from });
    setAttempt((current) => current + 1);
  };

  // A sample is already made, so there is no overview's progress to show (155f).
  const progressBar = sample ? null : (
    <OnboardingProgressBar
      phase={phase}
      fetching={kind?.fetching ?? null}
      ready={kind?.ready(found) ?? null}
      soon={soon}
      personal={personal}
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
        if (readFailure !== null) {
          return (
            <OnboardingReadFailure
              copy={onboardingFailureCopy(readFailure, progress.link, surface === "extension" ? "extension" : phone ? "phone" : "computer")}
              link={progress.link}
              onTryAgain={() => tryAgain("readFailure")}
              onAnotherLink={anotherLink}
            />
          );
        }
        return (
          <OnboardingVideo
            kind={kind}
            linkKind={recognised?.linkKind ?? "video"}
            link={progress.link}
            found={found}
            playlist={playlist.data ?? null}
            failed={failed}
            onLooksRight={next}
            onDifferentLink={() => {
              analytics.onboarding.video.differentLinkChosen();
              startAgain();
            }}
            onChooseVideo={(videoId) => {
              analytics.onboarding.video.differentVideoChosen();
              update({ sourceKey: SourceKey.parse(videoId), overviewId: null });
            }}
          />
        );
      case "topics":
        return (
          <OnboardingTopics
            chosen={progress.topics}
            suggestions={suggestions}
            saving={savingTopics}
            onChange={setPicking}
            onContinue={(chosen) => void saveTopics(chosen)}
          />
        );
      case "aboutYou":
        return (
          <OnboardingAboutYou
            aboutYou={aboutYou}
            topicNames={progress.topics}
            saving={updateSettings.isPending}
            onContinue={(answer) => void saveAboutYou(answer)}
          />
        );
      case "stepsForYou":
        return (
          <OnboardingStepsForYou
            aboutYou={aboutYou}
            onPersonalise={() => update({ step: "aboutYou" })}
            onNext={next}
          />
        );
      case "voice":
        return <OnboardingVoice onContinue={next} />;
      case "library":
      case "askYourAi":
      case "moreSources":
        return (
          <OnboardingSlide
            slide={step}
            topics={progress.topics}
            source={found?.source ?? null}
            written={share !== null}
            onNext={next}
          />
        );
      case "account":
        return (
          <OnboardingAccount
            overview={overview}
            teaserBeside={wide}
            sample={sample}
            failed={failed}
            onTryAgain={() => tryAgain("account")}
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
            sample={sample}
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
    const before = steps[indexOf(step) - 1];
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
          {progressBar !== null && <div className={styles.narrowProgress}>{progressBar}</div>}
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
                  {Array.from({ length: storyLength }, (_, index) => (
                    <span key={index} className={index < position ? styles.segmentDone : styles.segment} />
                  ))}
                </span>
                <span className={styles.visuallyHidden}>
                  Screen {position} of {storyLength}
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
          <OnboardingPreview
            progress={progressBar}
            phase={phase}
            kind={kind}
            found={found}
            failure={phase !== "failed" ? null : readFailure !== null || found === null ? "fetch" : "write"}
            answers={{
              current: step === "video" ? "source" : step === "topics" ? "topics" : step === "aboutYou" ? "you" : null,
              topics: step === "topics" ? (picking ?? progress.topics) : progress.topics,
              topicsAnswered: indexOf(step) > indexOf("topics"),
              personal,
              soon,
              voice: narrationVoiceName(settings?.narrationVoice ?? DEFAULT_NARRATION_VOICE),
            }}
            sortedInto={phase === "ready" ? sortedInto : null}
            forAnyone={sample}
            onTryAgain={() => tryAgain("preview")}
            teaser={wide && step === "account" && overview !== null && !failed ? <OnboardingTeaser overview={overview} sample={sample} beside /> : null}
          />
        </div>
      </div>
    </div>
  );
}

