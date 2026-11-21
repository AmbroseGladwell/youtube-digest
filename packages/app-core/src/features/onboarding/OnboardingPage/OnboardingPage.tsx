import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  aboutYouIsEmpty,
  aboutYouPatch,
  EMPTY_ABOUT_YOU,
  ONBOARDING_STEPS,
  OverviewId,
  sameTopicName,
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
import { PageScrolledSentinel } from "../../../components/shared/PageScrolledSentinel/PageScrolledSentinel.js";
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
import { useSurface } from "../../../app/SurfaceContext.js";
import { useIsPhone } from "../../../util/useIsPhone.js";
import { useMediaQuery } from "../../../util/useMediaQuery.js";
import { OnboardingAboutYou } from "../components/OnboardingAboutYou/OnboardingAboutYou.js";
import { OnboardingAccount } from "../components/OnboardingAccount/OnboardingAccount.js";
import { OnboardingAccountSide } from "../components/OnboardingAccountSide/OnboardingAccountSide.js";
import { OnboardingAnalytics } from "../components/OnboardingAnalytics/OnboardingAnalytics.js";
import { ONBOARDING_HEADING_ID } from "../components/OnboardingHeading/OnboardingHeading.js";
import { OnboardingKnowledgeMoment } from "../components/OnboardingKnowledgeMoment/OnboardingKnowledgeMoment.js";
import { OnboardingPills } from "../components/OnboardingPills/OnboardingPills.js";
import { OnboardingProjectsCard } from "../components/OnboardingProjectsCard/OnboardingProjectsCard.js";
import { OnboardingReadFailure } from "../components/OnboardingReadFailure/OnboardingReadFailure.js";
import { OnboardingSavingMoment } from "../components/OnboardingSavingMoment/OnboardingSavingMoment.js";
import { OnboardingSourceCard } from "../components/OnboardingSourceCard/OnboardingSourceCard.js";
import { OnboardingStepsMoment } from "../components/OnboardingStepsMoment/OnboardingStepsMoment.js";
import { OnboardingTopics, type OnboardingTopicSuggestions } from "../components/OnboardingTopics/OnboardingTopics.js";
import { OnboardingYourLink } from "../components/OnboardingYourLink/OnboardingYourLink.js";
import { OnboardingWaitScreen } from "../components/OnboardingWaitScreen/OnboardingWaitScreen.js";
import { useContentBelow } from "../useContentBelow.js";
import { useTopicSuggestions } from "../useTopicSuggestions.js";
import type { OnboardingProgress } from "../onboardingProgressStorage.js";
import { writeNextSteps } from "../nextStepsStorage.js";
import { useOnboardingProgress, writeProgress } from "../useOnboardingProgress.js";
import { useOnboardingRunState } from "../OnboardingRunContext.js";
import { foundIn, onboardingSourceOf, onboardingSources } from "../onboardingSources.js";
import { onboardingFailureCopy } from "../util/onboardingFailureCopy.js";
import { expectedOverviewMinutes } from "../util/expectedOverviewMinutes.js";
import { onboardingKindOf } from "../util/onboardingKindOf.js";
import styles from "./OnboardingPage.module.scss";
import { onboardingPageTestIds } from "./OnboardingPageTestIds.js";

// The questions offer Skip beside the stepper; a moment offers it beside its button (327d, 327e).
const SKIPPABLE: readonly OnboardingStep[] = ["topics", "aboutYou"];
// Six segments: Start, analytics, your link, topics, About you and the account. A moment shows the
// segment of the screen before it, and the wait has none (327a).
const SEGMENTS = 6;
const SEGMENT_OF: Readonly<Record<OnboardingStep, number | null>> = {
  analytics: 2,
  video: 3,
  saving: 3,
  topics: 4,
  knowledgeBase: 4,
  stepsForYou: 4,
  aboutYou: 5,
  account: 6,
  wait: null,
};
// A copy saved from a shared page, or a sample, is already made: nothing to check, nothing to wait for.
const FROM_SHARE_STEPS = ONBOARDING_STEPS.filter((step) => step !== "video" && step !== "wait");
const AFTER_THE_ANSWERS = ONBOARDING_STEPS.indexOf("account");
// Held outside the page, which remounts while signing in, so a copy is never saved, reserved and
// sorted twice at once.
const SHARES_BEING_SAVED = new Set<string>();

// Onboarding around the reader's first link (designs 327a–327m): read for free, shown back to
// them, then the moments and questions that make it theirs, the account, and the wait while it's
// written. Where they are is kept on the device, so a reload or the sign-in link in another tab
// carries on. The run lives above the router (OnboardingRunRuntime), so neither unmounts it
// (docs/features/onboarding.md).
export function OnboardingPage() {
  const [progress, update] = useOnboardingProgress();
  const leaving = useRef(false);
  if (progress === null) return leaving.current ? null : <Navigate to={Routes.home()} replace />;
  return (
    <Onboarding
      progress={progress}
      update={update}
      onLeave={() => {
        leaving.current = true;
      }}
    />
  );
}

interface OnboardingProps {
  progress: OnboardingProgress;
  update: (patch: Partial<OnboardingProgress> | null) => void;
  onLeave: () => void;
}

function Onboarding({ progress, update, onLeave }: OnboardingProps) {
  const navigate = useNavigate();
  const analytics = useAnalytics();
  const [contentEnd, contentBelow] = useContentBelow();
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
  const { run, attempt, retry, transcribe } = useOnboardingRunState();
  const [intent, setIntent] = useState<AuthIntent>(progress.way ?? "createAccount");
  const [savingTopics, setSavingTopics] = useState(false);
  const step = progress.step;
  const scroller = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (scroller.current !== null) scroller.current.scrollTop = 0;
  }, [step]);
  const share = progress.share;
  const sample = share?.sample ?? false;
  const steps = share === null ? ONBOARDING_STEPS : FROM_SHARE_STEPS;
  const indexOf = (of: OnboardingStep) => steps.indexOf(of);
  const sharedCopy = useMemo(() => (share === null ? null : savedFromShare(share.snapshot.note)), [share]);
  const saveFromShare = useSaveFromShare();
  const openLibraryAccountId = useLibraryAccountId();
  const wide = useMediaQuery("(min-width: 64rem)");
  const surface = useSurface();
  const phone = useIsPhone();

  const recognised = useMemo(() => onboardingSourceOf(progress.link), [progress.link]);
  const kind = recognised?.source ?? null;
  const link = youTubeLink(progress.link);
  const playlist = usePlaylistLookupQuery(link?.kind === "playlist" ? link.playlistId : null);
  const firstVideo = playlist.data?.entries.find((entry) => entry.availability === "available") ?? null;
  useEffect(() => {
    if (progress.sourceKey === null && firstVideo !== null) update({ sourceKey: SourceKey.parse(firstVideo.videoId) });
  }, [progress.sourceKey, firstVideo, update]);

  const stored = useQuery({
    queryKey: ["onboarding", "overview", accountId, progress.overviewId],
    queryFn: async () => (progress.overviewId === null ? null : await overviewStore.getOverview(progress.overviewId)),
    enabled: progress.overviewId !== null,
    refetchInterval: (query) => (signedIn && query.state.data == null ? 1000 : false),
  });
  const overview: Overview | null = stored.data ?? run.overview ?? sharedCopy;
  const found = run.found ?? (overview === null ? null : foundIn(overview));
  const noun = found !== null && kind !== null ? kind.noun("video", found) : "video";
  // Every onboarding event after Start says what the link turned out to be (327s).
  const tagged = found === null ? {} : { kind: onboardingKindOf(found) };
  const asked = useTopicSuggestions(found, kind, share === null && !signedIn);
  const offered = useMemo((): OnboardingTopicSuggestions | null => {
    if (found === null || kind === null) return null;
    return asked.status === "answered"
      ? { noun, names: asked.result.starter, newTopic: asked.result.newTopic, by: "model" }
      : {
          noun,
          names: suggestStarterTopics(found.source.title, found.about),
          newTopic: null,
          by: asked.status === "failed" ? "code-failed" : asked.status === "pending" ? "code-pending" : "code-only",
        };
  }, [found, kind, asked, noun]);
  // Held once the topics screen shows them, so a late answer never moves chips under the reader.
  const [held, setHeld] = useState<OnboardingTopicSuggestions | null>(null);
  useEffect(() => {
    setHeld((current) => (step !== "topics" ? null : (current ?? offered)));
  }, [step, offered]);
  const suggestions = step === "topics" ? (held ?? offered) : offered;
  const inAccount = signedIn && stored.data != null;
  const failed = progress.overviewId === null && (run.phase === "failed" || playlist.isError);
  const readFailure =
    failed && run.found === null && run.failure !== null && (run.failure.kind !== "other" || kind === onboardingSources.web)
      ? run.failure
      : null;

  const anotherLink = (given: string): boolean => {
    const another = onboardingSourceOf(given);
    if (another === null) {
      analytics.onboarding.start.linkRefused();
      return false;
    }
    analytics.onboarding.start.linkSubmitted({ kind: another.linkKind });
    update({ link: given.trim(), sourceKey: another.source.keyFromLink(given), tabId: null, overviewId: null });
    retry();
    return true;
  };

  const go = (next: OnboardingStep) =>
    update({ step: next, ...(ONBOARDING_STEPS.indexOf(next) >= AFTER_THE_ANSWERS ? { mayWrite: true } : {}) });
  const next = () => go(steps[indexOf(step) + 1] ?? "account");
  // From a shared page, leaving goes back to the page; a sample came from Start, so it goes back there.
  const startAgain = () => {
    onLeave();
    update(null);
    if (share === null || share.sample) void navigate(Routes.home(), { replace: true });
    else globalThis.location.assign(Routes.sharedOverview(share.token));
  };

  const finish = (overviewId: string) => {
    analytics.onboarding.finished.revealed({
      ...tagged,
      way: progress.way ?? "signIn",
      from: share === null ? "link" : share.sample ? "sample" : "share",
    });
    libraryMove.dismiss();
    writeNextSteps({ overviewId: OverviewId.parse(overviewId), dismissed: [], forAnyone: null, sample });
    onLeave();
    void navigate(Routes.overview(overviewId), { replace: true });
    writeProgress(null);
  };

  const afterAnalytics = steps[indexOf("analytics") + 1] ?? "account";
  useEffect(() => {
    if (step === "analytics" && analyticsAnswered) update({ step: afterAnalytics });
  }, [step, analyticsAnswered, afterAnalytics, update]);

  // A shared copy or sample goes into the account once there is one; a sample waits for the
  // topics picked here, since it's sorted into them.
  const { refetch: refetchStored } = stored;
  const answersIn = libraryMove.answersIn === accountId;
  useEffect(() => {
    if (share === null || !signedIn || openLibraryAccountId !== accountId || inAccount) return;
    if (share.sample && !answersIn) return;
    const saving = `${accountId}:${share.token}`;
    if (SHARES_BEING_SAVED.has(saving)) return;
    SHARES_BEING_SAVED.add(saving);
    void (async () => {
      if ((await overviewStore.getOverview(share.snapshot.note.id)) === null) {
        await saveFromShare(share.token, share.snapshot, { sample: share.sample });
      }
      await refetchStored();
    })().finally(() => {
      SHARES_BEING_SAVED.delete(saving);
    });
  }, [share, signedIn, openLibraryAccountId, accountId, inAccount, answersIn, overviewStore, saveFromShare, refetchStored]);

  // Signed in from the account screen: a link's run goes to the wait; signed in some other way with
  // nothing to carry on with, onboarding has nothing to do.
  useEffect(() => {
    if (!signedIn) return;
    if (progress.overviewId === null && (progress.way === null || kind === null) && share === null) {
      onLeave();
      update(null);
      void navigate(Routes.home(), { replace: true });
    } else if (share === null && step !== "wait" && progress.way !== null) {
      update({ step: "wait", mayWrite: true });
    }
  }, [signedIn, progress.overviewId, progress.way, kind, share, step, update, navigate, onLeave]);

  useEffect(() => {
    if (!signedIn || progress.way === null || progress.landed !== null) return;
    const landedWith = progress.overviewId !== null ? "ready" : failed ? "failed" : "writing";
    analytics.onboarding.account.landed({ ...tagged, way: progress.way, overview: landedWith });
    update({ landed: { at: Date.now(), overview: landedWith, arrived: false } });
  }, [signedIn, progress.way, progress.landed, progress.overviewId, failed, analytics, update]);
  useEffect(() => {
    if (!inAccount || progress.landed === null || progress.landed.arrived) return;
    analytics.onboarding.overview.arrived({ ...tagged, seconds: Math.max(0, Math.round((Date.now() - progress.landed.at) / 1000)), step });
    update({ landed: { ...progress.landed, arrived: true } });
  }, [inAccount, progress.landed, step, analytics, update]);

  // A shared copy or sample has nothing to wait for: it opens as soon as it's in the account.
  const opened = useRef(false);
  useEffect(() => {
    if (share === null || !inAccount || progress.overviewId === null || opened.current) return;
    opened.current = true;
    finish(progress.overviewId);
  });

  // The way in is the account screen's own until the reader switches it, so a sign-in landing
  // knows it came from here.
  useEffect(() => {
    if (step === "account" && progress.way === null) update({ way: "createAccount", mayWrite: true });
  }, [step, progress.way, update]);

  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (shown.current === step) return;
    shown.current = step;
    analytics.onboarding.step.shown({ ...tagged, step });
  }, [step, analytics]);

  const heardFailure = useRef(-1);
  useEffect(() => {
    if (!failed || heardFailure.current === attempt) return;
    heardFailure.current = attempt;
    analytics.onboarding.overview.failed({ ...tagged, step, afterAccount: signedIn });
  }, [failed, attempt, step, signedIn, analytics]);

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
      ...tagged,
      suggestedBy: suggested.length === 0 ? "none" : (suggestions?.by ?? "none"),
      picked: chosen.filter((name) => STARTER_TOPICS.some((topic) => sameTopicName(topic.name, name))).length,
      typed: chosen.filter((name) => !STARTER_TOPICS.some((topic) => sameTopicName(topic.name, name))).length,
      suggested: suggested.length,
      pickedSuggested: chosen.filter((name) => suggested.some((offered) => sameTopicName(offered, name))).length,
    });
    update({ topics: chosen });
    next();
  };

  const saveAboutYou = async (answer: AboutYou) => {
    await updateSettings.mutateAsync(aboutYouPatch(answer));
    analytics.onboarding.aboutYou.continued({
      ...tagged,
      who: answer.who.length,
      time: answer.time.length,
      focus: answer.focus.length,
      typed: typedEntryCount(answer, progress.topics),
    });
    go("account");
  };

  const personal = !aboutYouIsEmpty(aboutYou);
  const tryAgain = (from: "account" | "readFailure") => {
    analytics.onboarding.overview.retried({ ...tagged, from });
    retry();
  };

  // Their card with their answers: on About you the count of topics, what's inside and where it's
  // kept (327i); on the account each topic and the pills (327l).
  const savedCard = (where: "aboutYou" | "account"): ReactNode =>
    found === null || kind === null ? null : (
      <>
        <OnboardingSourceCard kind={kind} found={found} size="row" />
        {(progress.topics.length > 0 || personal) && (
          <ul className={styles.answers} aria-label="Your answers">
            {where === "account" ? (
              progress.topics.map((name) => <li key={name}>{name}</li>)
            ) : progress.topics.length > 0 ? (
              <li>{progress.topics.length === 1 ? "1 topic" : `${progress.topics.length} topics`}</li>
            ) : null}
            {personal && (
              <li className={styles.personal}>
                <StrokeIcon name="check" size={11} />
                Personalised
              </li>
            )}
          </ul>
        )}
        {where === "account" ? (
          <OnboardingPills pills={kind.yourLink(found, null).pills} minutes={expectedOverviewMinutes(found.source)} />
        ) : (
          <div className={styles.paneDetails}>
            <p className={styles.paneInside}>{kind.yourLink(found, null).inside}</p>
            <p className={styles.paneSaved}>
              <StrokeIcon name="folder" size={14} />
              Saved to your library, ready for you and your AI.
            </p>
          </div>
        )}
      </>
    );

  const skip = () => {
    analytics.onboarding.step.skipped({ ...tagged, step });
    if (step === "stepsForYou" || step === "aboutYou") go("account");
    else next();
  };

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
              onTranscribe={transcribe}
              onAnotherLink={anotherLink}
            />
          );
        }
        return (
          <OnboardingYourLink
            kind={kind}
            linkKind={recognised?.linkKind ?? "video"}
            link={progress.link}
            found={found}
            playlist={playlist.data ?? null}
            failed={failed}
            onLooksRight={next}
            onDifferentLink={() => {
              analytics.onboarding.video.differentLinkChosen(tagged);
              startAgain();
            }}
            onChooseVideo={(videoId) => {
              analytics.onboarding.video.differentVideoChosen(tagged);
              update({ sourceKey: SourceKey.parse(videoId), overviewId: null });
            }}
          />
        );
      case "saving":
        return <OnboardingSavingMoment onContinue={next} onSkip={skip} />;
      case "topics":
        return (
          <OnboardingTopics
            chosen={progress.topics}
            suggestions={suggestions}
            saving={savingTopics}
            below={wide ? null : <OnboardingProjectsCard compact />}
            onContinue={(chosen) => void saveTopics(chosen)}
          />
        );
      case "knowledgeBase":
        return <OnboardingKnowledgeMoment onContinue={next} onSkip={skip} />;
      case "stepsForYou":
        return (
          <OnboardingStepsMoment
            noun={noun === "episode" || noun === "article" || noun === "recipe" ? noun : "video"}
            onAddContext={next}
            onSkip={skip}
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
      case "account":
        return (
          <OnboardingAccount
            saved={savedCard("account")}
            sideBeside={wide}
            form={
              <RequestLinkFlow
                key={intent}
                intent={intent}
                onboarding={{
                  onSwitchIntent: (way) => {
                    analytics.onboarding.account.chosen({ ...tagged, way });
                    setIntent(way);
                    update({ way });
                  },
                }}
              />
            }
          />
        );
      case "wait":
        return (
          <OnboardingWaitScreen
            kind={kind}
            found={found}
            run={run}
            overview={inAccount ? overview : null}
            failed={failed}
            startedAt={progress.landed?.at ?? null}
            topics={progress.topics}
            personal={personal}
            focus={aboutYou.focus[0] ?? null}
            onTryAgain={() => tryAgain("account")}
            onOpen={() => {
              if (progress.overviewId !== null) finish(progress.overviewId);
            }}
          />
        );
    }
  })();

  const aside = (() => {
    if (!wide) return null;
    if (step === "topics") return <OnboardingProjectsCard />;
    if (step === "account") return <OnboardingAccountSide saved={savedCard("account")} />;
    if (step === "aboutYou" && found !== null) {
      return (
        <section className={styles.paneCard} aria-label="Your overview, once you're in">
          <span className={styles.paneLabel}>Your overview, once you’re in</span>
          {savedCard("aboutYou")}
        </section>
      );
    }
    return null;
  })();

  const segment = SEGMENT_OF[step];
  const back = () => {
    analytics.onboarding.step.backChosen({ ...tagged, step });
    const before = steps[indexOf(step) - 1];
    if (before === undefined || (before === "analytics" && analyticsAnswered)) startAgain();
    else update({ step: before });
  };

  return (
    <div className={styles.root} data-content-below={contentBelow ? "" : undefined} data-testid={onboardingPageTestIds.root}>
      <header className={styles.top}>
        <Link className={styles.brand} to={Routes.home()}>
          <OverviewMark />
          <span className={styles.brandName}>The Overview</span>
        </Link>
      </header>

      <div
        className={styles.layout}
        data-aside={aside === null ? undefined : ""}
        data-full={step === "wait" ? "" : undefined}
        ref={scroller}
        data-testid={onboardingPageTestIds.scroller}
      >
        <PageScrolledSentinel />
        <main className={styles.main} aria-labelledby={ONBOARDING_HEADING_ID}>
          <>
            {segment !== null && (
              <div className={styles.stepper} data-sticky-fade="" data-testid={onboardingPageTestIds.stepper}>
                <div className={styles.nav}>
                  {!signedIn && (
                    <button type="button" className={styles.back} aria-label="Back" onClick={back} data-testid={onboardingPageTestIds.back}>
                      <StrokeIcon name="chevronLeft" size={18} />
                    </button>
                  )}
                  <span className={styles.segments} aria-hidden="true" data-testid={onboardingPageTestIds.segments}>
                    {Array.from({ length: SEGMENTS }, (_, index) => (
                      <span key={index} className={index < segment ? styles.segmentDone : styles.segment} />
                    ))}
                  </span>
                  <span className={styles.stepCount} data-testid={onboardingPageTestIds.stepCount}>
                    Step {segment} of {SEGMENTS}
                  </span>
                  {SKIPPABLE.includes(step) && (
                    <button type="button" className={styles.skip} onClick={skip} data-testid={onboardingPageTestIds.skip}>
                      Skip
                    </button>
                  )}
                </div>
              </div>
            )}
            {screen}
          </>
          <span className={styles.end} ref={contentEnd} aria-hidden="true" />
        </main>

        {aside !== null && <div className={styles.aside}>{aside}</div>}
      </div>
    </div>
  );
}
