import { OnboardingArriving, type OnboardingArrivingPhase } from "../OnboardingArriving/OnboardingArriving.js";
import { OnboardingHeading } from "../OnboardingHeading/OnboardingHeading.js";
import styles from "./OnboardingNearlyThere.module.scss";
import { onboardingNearlyThereTestIds } from "./OnboardingNearlyThereTestIds.js";

export interface OnboardingNearlyThereProps {
  phase: OnboardingArrivingPhase;
  onTryAgain: () => void;
}

// A reader who signed in to an account they already had before the overview landed: there's
// no plan to pick, so this holds the place until the overview is in the account and opens
// (docs/features/onboarding.md, "The account").
export function OnboardingNearlyThere({ phase, onTryAgain }: OnboardingNearlyThereProps) {
  return (
    <div className={styles.root} data-testid={onboardingNearlyThereTestIds.root}>
      <div className={styles.intro}>
        <OnboardingHeading>Nearly there</OnboardingHeading>
        <p className={styles.lead}>You're signed in. Your overview opens as soon as it's ready.</p>
      </div>
      <OnboardingArriving phase={phase} onTryAgain={onTryAgain} />
    </div>
  );
}
