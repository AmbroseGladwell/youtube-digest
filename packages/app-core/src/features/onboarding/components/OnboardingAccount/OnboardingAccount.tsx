import type { ReactNode } from "react";
import { OnboardingAccountSide } from "../OnboardingAccountSide/OnboardingAccountSide.js";
import styles from "./OnboardingAccount.module.scss";
import { onboardingAccountTestIds } from "./OnboardingAccountTestIds.js";

export interface OnboardingAccountProps {
  // The way in: the inline form, then the code in its place (327l, 327l-2).
  form: ReactNode;
  // Their card with its pills and answers, "Saved with your account"; null for nothing to show.
  saved: ReactNode | null;
  // On a wide window the page's own side column holds the card and what you get (327l).
  sideBeside: boolean;
}

// Design 327l: the account comes before anything is written, so the screen shows what they've put
// in and what they'll get beside the way in. Email only for now (docs/features/onboarding.md,
// "The account").
export function OnboardingAccount({ form, saved, sideBeside }: OnboardingAccountProps) {
  return (
    <div className={styles.root} data-testid={onboardingAccountTestIds.root}>
      <div className={styles.form}>{form}</div>
      {!sideBeside && <OnboardingAccountSide saved={saved} />}
    </div>
  );
}
