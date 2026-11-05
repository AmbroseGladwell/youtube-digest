import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import type { OnboardingRunPhase } from "../../useOnboardingRun.js";
import { writingStarts } from "../../util/writingStarts.js";
import styles from "./OnboardingProgressBar.module.scss";
import { onboardingProgressBarTestIds } from "./OnboardingProgressBarTestIds.js";

export interface OnboardingProgressBarProps {
  phase: OnboardingRunPhase;
  // What fetching is called for this kind of source; null when the link wasn't recognised.
  fetching: string | null;
  // What's in hand once fetched ("Transcript ready"); null when the link wasn't recognised.
  ready: string | null;
  // The next Continue lets writing go.
  soon: boolean;
  personal: boolean;
  // Null on the account and plan screens, where there's nowhere for See your overview to go.
  onSeeOverview: (() => void) | null;
}

// The overview's own progress (175j, 175k). Until writing starts it's a calm line, never a bar
// that could look stalled; the bar shows only once there is writing to show, then becomes
// See your overview, which never waits on the questions.
export function OnboardingProgressBar({ phase, fetching, ready, soon, personal, onSeeOverview }: OnboardingProgressBarProps) {
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
        {onSeeOverview !== null && (
          <button
            type="button"
            className={styles.see}
            onClick={onSeeOverview}
            data-testid={onboardingProgressBarTestIds.seeOverview}
          >
            See your overview
            <StrokeIcon name="chevronRight" size={16} />
          </button>
        )}
      </div>
    );
  }
  if (phase === "fetching" || phase === "waiting") {
    return (
      <p className={styles.status} role="status" aria-live="polite" data-testid={onboardingProgressBarTestIds.status}>
        {phase === "fetching" ? (
          <>
            <span className={styles.spinner}>
              <StrokeIcon name="loader" size={14} />
            </span>
            <span className={styles.lead}>{fetching ?? "Fetching it"}…</span>
          </>
        ) : (
          <>
            <span className={styles.tick}>
              <StrokeIcon name="check" size={14} />
            </span>
            <span>
              <span className={styles.lead}>{ready ?? "Ready"}</span>
              <span className={styles.phase}> · {writingStarts(soon)}</span>
            </span>
          </>
        )}
      </p>
    );
  }
  return (
    <div className={styles.root} role="group" aria-label="Your overview" data-testid={onboardingProgressBarTestIds.root}>
      <p className={styles.line} aria-live="polite">
        <span className={styles.lead}>Making your overview</span>
        <span className={styles.phase} data-testid={onboardingProgressBarTestIds.phase}>
          {" "}
          · {personal ? "Writing it for you" : "Writing it"}
        </span>
      </p>
      <span className={styles.track} aria-hidden="true">
        <span className={styles.fill} />
      </span>
    </div>
  );
}
