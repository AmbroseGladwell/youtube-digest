import type { ReactNode } from "react";
import { OnboardingArriving, type OnboardingArrivingPhase } from "../OnboardingArriving/OnboardingArriving.js";
import { OnboardingHeading } from "../OnboardingHeading/OnboardingHeading.js";
import styles from "./OnboardingNearlyThere.module.scss";
import { onboardingNearlyThereTestIds } from "./OnboardingNearlyThereTestIds.js";

export interface OnboardingNearlyThereProps {
  phase: OnboardingArrivingPhase;
  // A new account has just picked its plan; a sign-in to one already held has no plan to pick.
  after: "plan" | "signIn";
  // On a phone, the overview taking shape, which a wide window shows beside the screens instead.
  card: ReactNode;
  onTryAgain: () => void;
}

// The account exists and the overview isn't in it yet: this holds the place, after the plan or
// after a sign-in, until the overview is in the account and opens on its own
// (docs/features/onboarding.md, "The plan").
export function OnboardingNearlyThere({ phase, after, card, onTryAgain }: OnboardingNearlyThereProps) {
  return (
    <div className={styles.root} data-testid={onboardingNearlyThereTestIds.root}>
      <div className={styles.intro}>
        <OnboardingHeading>Nearly there</OnboardingHeading>
        <p className={styles.lead}>
          {after === "plan" ? "Your plan is set. Your overview opens as soon as it's ready." : "You're signed in. Your overview opens as soon as it's ready."}
        </p>
      </div>
      <OnboardingArriving phase={phase} onTryAgain={onTryAgain} />
      {card}
    </div>
  );
}
