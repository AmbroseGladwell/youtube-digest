import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./OnboardingArriving.module.scss";
import { onboardingArrivingTestIds } from "./OnboardingArrivingTestIds.js";

// What the overview is doing once the account exists and it isn't in it yet: still being
// written, made and on its way in, or failed, which offers the run again.
export type OnboardingArrivingPhase = "writing" | "bringingIn" | "failed";

export interface OnboardingArrivingProps {
  phase: OnboardingArrivingPhase;
  onTryAgain: () => void;
}

// Under the plan, and on the screen a sign-in waits on: the reader made their account before
// the overview landed, so this says what it's doing rather than looking stuck
// (docs/features/onboarding.md, "The plan").
export function OnboardingArriving({ phase, onTryAgain }: OnboardingArrivingProps) {
  if (phase === "failed") {
    return (
      <div className={styles.failed} role="alert" data-testid={onboardingArrivingTestIds.failed}>
        <span className={styles.failedIcon}>
          <StrokeIcon name="alert" size={16} />
        </span>
        <span className={styles.failedText}>Something went wrong making your overview.</span>
        <button type="button" className={styles.tryAgain} onClick={onTryAgain} data-testid={onboardingArrivingTestIds.tryAgain}>
          <StrokeIcon name="refresh" size={14} />
          Try again
        </button>
      </div>
    );
  }
  return (
    <p
      className={styles.status}
      role="status"
      data-testid={phase === "writing" ? onboardingArrivingTestIds.writing : onboardingArrivingTestIds.bringingIn}
    >
      <span className={styles.spinner}>
        <StrokeIcon name="loader" size={14} />
      </span>
      {phase === "writing" ? "Still writing your overview…" : "Bringing your overview into your account…"}
    </p>
  );
}
