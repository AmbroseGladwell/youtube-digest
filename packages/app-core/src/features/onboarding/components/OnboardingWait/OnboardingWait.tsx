import { useEffect, useState, type ReactNode } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useNow } from "../../../../util/useNow.js";
import type { WaitStage, WaitStageState } from "../../waitStages.js";
import { scriptLineIndex, waitBarFraction, waitEstimateLine, type WaitPhase } from "../../util/waitTimeline.js";
import { OnboardingHeading } from "../OnboardingHeading/OnboardingHeading.js";
import styles from "./OnboardingWait.module.scss";
import { onboardingWaitTestIds } from "./OnboardingWaitTestIds.js";

const MIN_SECONDS_PER_SCRIPT_LINE = 3;
const INTERACTIVE = "a, button, input, textarea, select, label, summary, [contenteditable], [role='button'], [role='radio'], [role='tab']";

export interface OnboardingWaitFailure {
  title: string;
  body: string;
}

export interface OnboardingWaitProps {
  heading: string;
  cardLabel: string;
  card: ReactNode;
  stages: readonly WaitStage[];
  script: readonly string[];
  expectedSeconds: number;
  startedAt?: number;
  keepTabLine: string;
  phase: WaitPhase;
  failure: OnboardingWaitFailure | null;
  onTryAgain: () => void;
  openLabel: string;
  onOpen: () => void;
  setups: ReactNode;
}

const StageMark = ({ state }: { state: WaitStageState }) => {
  return (
    <svg
      className={styles.mark}
      data-state={state}
      viewBox="0 0 32 32"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <g className={styles.arc}>
        <circle cx="16" cy="14.5" r="7.5" strokeWidth="3" strokeDasharray="34 48" />
      </g>
      <circle className={styles.ring} cx="16" cy="14.5" r="7.5" strokeWidth="3" />
      <rect className={styles.underline} x="7" y="25" width="18" height="2.5" />
      <path className={styles.tick} d="M11.75 14.9l2.8 2.8 5.65-6.1" strokeWidth="2.5" pathLength={1} />
    </svg>
  );
};

const STATE_SAID: Record<WaitStageState, string> = { waiting: ", waiting", running: ", in progress", done: "" };

const announcementOf = (phase: WaitPhase, heading: string, stages: readonly WaitStage[]): string => {
  if (phase === "ready") {
    return heading;
  }
  if (phase === "failed") {
    return "";
  }
  const lastDone = [...stages].reverse().find((stage) => stage.state === "done");
  const running = stages.find((stage) => stage.state === "running");
  return [lastDone?.doneLine, running?.name].filter((part) => part != null).join(". ");
};

export interface WaitSubLine {
  text: string;
  key: string;
}

export const OnboardingWait = ({
  heading,
  cardLabel,
  card,
  stages,
  script,
  expectedSeconds,
  startedAt: startedAtGiven,
  keepTabLine,
  phase,
  failure,
  onTryAgain,
  openLabel,
  onOpen,
  setups,
}: OnboardingWaitProps) => {
  const now = useNow(1000);
  const [startedAt] = useState(() => startedAtGiven ?? Date.now());
  const writingAt = stages.length - 1;
  const writingRunning = phase === "running" && stages[writingAt]?.state === "running";
  const [writingSince, setWritingSince] = useState<number | null>(null);
  if (writingRunning && writingSince === null) {
    setWritingSince(now);
  }

  const elapsedSeconds = Math.max(0, (now - startedAt) / 1000);
  const doneStages = stages.filter((stage) => stage.state === "done").length;
  const barFraction = waitBarFraction({ phase, elapsedSeconds, expectedSeconds, doneStages });
  const estimate = waitEstimateLine({ phase, elapsedSeconds, expectedSeconds });

  const writingStartedSeconds = writingSince === null ? 0 : (writingSince - startedAt) / 1000;
  const scriptSeconds = Math.max(expectedSeconds - writingStartedSeconds, script.length * MIN_SECONDS_PER_SCRIPT_LINE);
  const scriptAt = writingSince === null ? -1 : scriptLineIndex(script.length, (now - writingSince) / 1000, scriptSeconds);

  useEffect(() => {
    if (phase !== "ready") {
      return;
    }
    const openOnEnter = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
      if (event.target instanceof Element && event.target.closest(INTERACTIVE) !== null) {
        return;
      }
      onOpen();
    };
    window.addEventListener("keydown", openOnEnter);
    return () => window.removeEventListener("keydown", openOnEnter);
  }, [phase, onOpen]);

  const subLineOf = (stage: WaitStage, index: number): WaitSubLine | null => {
    if (phase !== "running" || stage.state !== "running") {
      return null;
    }
    if (stage.detail) {
      return { text: stage.detail, key: `detail-${stage.detail}` };
    }
    if (index === writingAt && scriptAt >= 0) {
      return { text: script[scriptAt] ?? "", key: `script-${scriptAt}` };
    }
    return null;
  };

  return (
    <div className={styles.root} data-phase={phase} data-testid={onboardingWaitTestIds.root}>
      <div className={styles.main}>
        <OnboardingHeading>
          <span key={heading} className={styles.headingText}>
            {heading}
          </span>
        </OnboardingHeading>

        <div className={styles.card} data-testid={onboardingWaitTestIds.card}>
          <span className={styles.cardLabel}>{cardLabel}</span>
          {card}
        </div>

        <div className={styles.progress}>
          <ol className={styles.stages}>
            {stages.map((stage, index) => {
              const subLine = subLineOf(stage, index);
              return (
                <li key={stage.name} className={styles.stage} data-state={stage.state} data-testid={onboardingWaitTestIds.stage(index)}>
                  <StageMark state={stage.state} />
                  <span className={styles.stageText}>
                    <span key={stage.state === "done" ? "done" : "name"} className={stage.state === "done" ? styles.doneLine : styles.name}>
                      {stage.state === "done" ? (stage.doneLine ?? stage.name) : stage.name}
                      <span className={styles.visuallyHidden}>{STATE_SAID[stage.state]}</span>
                    </span>
                    {subLine !== null && (
                      <span key={subLine.key} className={styles.subLine} data-testid={onboardingWaitTestIds.script}>
                        {subLine.text}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>

          {phase !== "failed" && (
            <>
              <div className={styles.bar} aria-hidden="true" data-testid={onboardingWaitTestIds.bar}>
                <span className={styles.barFill} style={{ width: `${(barFraction * 100).toFixed(1)}%` }} />
              </div>
              <p className={styles.estimate} data-testid={onboardingWaitTestIds.estimate}>
                {estimate}
              </p>
            </>
          )}
        </div>

        {phase === "running" && (
          <p className={styles.keepTab} data-testid={onboardingWaitTestIds.keepTab}>
            <StrokeIcon name="check" size={13} />
            {keepTabLine}
          </p>
        )}

        {phase === "failed" && failure !== null && (
          <div className={styles.failure} role="alert" data-testid={onboardingWaitTestIds.failure}>
            <p className={styles.failureTitle}>{failure.title}</p>
            <p className={styles.failureBody}>{failure.body}</p>
            <button type="button" className={styles.tryAgain} onClick={onTryAgain} data-testid={onboardingWaitTestIds.tryAgain}>
              Try again
            </button>
          </div>
        )}
      </div>

      <aside className={styles.setups} aria-label="Quick set-ups" data-testid={onboardingWaitTestIds.setups}>
        {setups}
      </aside>

      {phase === "ready" && (
        <div className={styles.foot}>
          <button type="button" className={styles.open} onClick={onOpen} data-testid={onboardingWaitTestIds.open}>
            {openLabel}
          </button>
        </div>
      )}

      <p className={styles.visuallyHidden} aria-live="polite" data-testid={onboardingWaitTestIds.announcer}>
        {announcementOf(phase, heading, stages)}
      </p>
    </div>
  );
};
