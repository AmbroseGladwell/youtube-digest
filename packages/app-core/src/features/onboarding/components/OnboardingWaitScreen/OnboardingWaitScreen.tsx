import { noteTiming, overviewNoteLines, type Overview } from "@overview/domain";
import type { OnboardingFound, OnboardingSource } from "../../onboardingSources.js";
import type { OnboardingRun } from "../../useOnboardingRun.js";
import { useKeepTabWhileRunning } from "../../useKeepTabWhileRunning.js";
import { WAIT_COPY, waitScript, waitStage, waitStageIds, type WaitKind, type WaitStageId, type WaitStageState } from "../../waitStages.js";
import type { WaitPhase } from "../../util/waitTimeline.js";
import { OnboardingPills } from "../OnboardingPills/OnboardingPills.js";
import { OnboardingSetups } from "../OnboardingSetups/OnboardingSetups.js";
import { OnboardingSourceCard } from "../OnboardingSourceCard/OnboardingSourceCard.js";
import { OnboardingWait } from "../OnboardingWait/OnboardingWait.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { expectedOverviewMinutes } from "../../util/expectedOverviewMinutes.js";
import { onboardingKindOf } from "../../util/onboardingKindOf.js";
import styles from "./OnboardingWaitScreen.module.scss";

// The writer's own pace isn't fitted yet (OV-326's writingMs), so the timed line spreads over this.
const EXPECTED_SECONDS = 120;
const FAILURE = {
  title: "We couldn’t make your overview",
  body: "Something went wrong writing it, and nothing was counted. Try again in a moment.",
};

export interface OnboardingWaitScreenProps {
  kind: OnboardingSource | null;
  found: OnboardingFound | null;
  run: OnboardingRun;
  // The overview once it's in the account; null until then.
  overview: Overview | null;
  failed: boolean;
  startedAt: number | null;
  topics: readonly string[];
  personal: boolean;
  // What About you says they're focusing on, for the script's last line.
  focus: string | null;
  onTryAgain: () => void;
  onOpen: () => void;
}

// Design 327m, live on page 7: the first paid screen. Each stage is a real event of the run (the
// words found, writing begun, the overview in the account); only the line under the writing stage
// is a timed script (docs/features/onboarding.md, "The wait").
export const OnboardingWaitScreen = ({
  kind,
  found,
  run,
  overview,
  failed,
  startedAt,
  topics,
  personal,
  focus,
  onTryAgain,
  onOpen,
}: OnboardingWaitScreenProps) => {
  const analytics = useAnalytics();
  const waitKind: WaitKind = found === null ? "video" : onboardingKindOf(found);
  const copy = WAIT_COPY[waitKind];
  const phase: WaitPhase = failed ? "failed" : overview !== null ? "ready" : "running";
  useKeepTabWhileRunning(phase, found?.source.title ?? "Your overview");

  // Known from the check before the account (327y-2), or found once the words turn out missing.
  const transcribing =
    run.transcription !== null || (found?.episodeWords?.words === "none" && found.episodeWords.transcription.status !== "free");
  const ids = waitStageIds(waitKind, { transcribing });
  const sourceIn = run.sourceWords !== null || run.writingStarted || phase === "ready";
  const writing = run.writingStarted || phase === "ready";
  const stateOf = (id: WaitStageId): WaitStageState => {
    if (id === "findEpisode") {
      return found === null ? "running" : "done";
    }
    if (id === "write" || id === "prepareRecipe") {
      return phase === "ready" ? "done" : writing ? "running" : "waiting";
    }
    return sourceIn ? "done" : "running";
  };
  const episodeMinutes =
    found?.source.kind === "podcast" && found.source.durationMs !== null ? Math.round(found.source.durationMs / 60_000) : null;
  const stages = ids.map((id) =>
    waitStage(id, stateOf(id), {
      transcriptWords: run.sourceWords,
      pageWords: run.sourceWords,
      readMinutes: overview === null ? null : noteTiming(overviewNoteLines(overview)).readMinutes,
      ingredients: overview?.recipe?.ingredients.length ?? null,
      steps: overview?.recipe?.steps.length ?? null,
      episodeMinutes,
    }),
  );

  const card =
    found === null || kind === null ? null : (
      <div className={styles.card}>
        <OnboardingSourceCard kind={kind} found={found} size="row" />
        {phase === "ready" && (
          <>
            {(topics.length > 0 || personal) && (
              <ul className={styles.answers} aria-label="Your answers">
                {topics.map((name) => (
                  <li key={name}>{name}</li>
                ))}
                {personal && <li className={styles.personal}>Personalised</li>}
              </ul>
            )}
            <OnboardingPills pills={kind.yourLink(found, null).pills} minutes={expectedOverviewMinutes(found.source)} />
          </>
        )}
      </div>
    );

  return (
    <OnboardingWait
      heading={phase === "ready" ? copy.readyHeading : copy.heading}
      cardLabel={copy.cardLabel}
      card={card}
      stages={stages}
      script={waitScript(waitKind, { focus, transcribing })}
      expectedSeconds={EXPECTED_SECONDS}
      {...(startedAt === null ? {} : { startedAt })}
      keepTabLine={copy.keepTabLine}
      phase={phase}
      failure={failed ? FAILURE : null}
      onTryAgain={onTryAgain}
      openLabel={copy.openLabel}
      onOpen={onOpen}
      setups={
        <OnboardingSetups
          ready={phase === "ready"}
          onOpened={(setup) => analytics.onboarding.wait.setupOpened({ ...(found === null ? {} : { kind: waitKind }), setup })}
        />
      }
    />
  );
};
