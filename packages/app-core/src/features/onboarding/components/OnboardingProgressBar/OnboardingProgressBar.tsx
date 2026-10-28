import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import type { OnboardingRunPhase } from "../../useOnboardingRun.js";
import styles from "./OnboardingProgressBar.module.scss";
import { onboardingProgressBarTestIds } from "./OnboardingProgressBarTestIds.js";

const PHASE_LINE: Record<Exclude<OnboardingRunPhase, "ready" | "failed">, string> = {
  fetching: "Fetching the video",
  waiting: "Writing starts once you've told us about you",
  writing: "Writing it for you",
};

// How far along each stage is drawn, not a measurement of anything: the stages are what is
// known (docs/prototype/constraints.md).
const PHASE_FILL: Record<Exclude<OnboardingRunPhase, "ready" | "failed">, number> = {
  fetching: 12,
  waiting: 25,
  writing: 60,
};

export interface OnboardingProgressBarProps {
  phase: OnboardingRunPhase;
  onSeeOverview: () => void;
}

// The overview's own progress, above the screens (design 46b's first layer): what the run is
// doing, then See your overview once it's ready, which never waits on the questions.
export function OnboardingProgressBar({ phase, onSeeOverview }: OnboardingProgressBarProps) {
  if (phase === "failed") {
    return (
      <p className={styles.failed} role="alert" data-testid={onboardingProgressBarTestIds.failed}>
        <StrokeIcon name="alert" size={14} />
        Couldn't make your overview
      </p>
    );
  }
  if (phase === "ready") {
    return (
      <div data-testid={onboardingProgressBarTestIds.root}>
        <p className={styles.announce} role="status">
          Your overview is ready
        </p>
        <button
          type="button"
          className={styles.see}
          onClick={onSeeOverview}
          data-testid={onboardingProgressBarTestIds.seeOverview}
        >
          See your overview
          <StrokeIcon name="chevronRight" size={16} />
        </button>
      </div>
    );
  }
  return (
    <div className={styles.root} role="group" aria-label="Your overview" data-testid={onboardingProgressBarTestIds.root}>
      <p className={styles.line}>
        <span className={styles.lead}>Making your overview</span>
        <span className={styles.phase} data-testid={onboardingProgressBarTestIds.phase}>
          {" "}
          · {PHASE_LINE[phase]}
        </span>
      </p>
      <span className={styles.track} aria-hidden="true">
        <span className={styles.fill} style={{ width: `${PHASE_FILL[phase]}%` }} />
      </span>
    </div>
  );
}
