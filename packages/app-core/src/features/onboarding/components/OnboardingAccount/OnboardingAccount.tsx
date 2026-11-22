import type { ReactNode } from "react";
import { OnboardingAccountSide } from "../OnboardingAccountSide/OnboardingAccountSide.js";
import styles from "./OnboardingAccount.module.scss";
import { onboardingAccountTestIds } from "./OnboardingAccountTestIds.js";

export interface OnboardingAccountProps {
  form: ReactNode;
  saved: ReactNode | null;
  sideBeside: boolean;
}

// docs/features/onboarding.md, "The account".
export const OnboardingAccount = ({ form, saved, sideBeside }: OnboardingAccountProps) => {
  return (
    <div className={styles.root} data-testid={onboardingAccountTestIds.root}>
      <div className={styles.form}>{form}</div>
      {!sideBeside && <OnboardingAccountSide saved={saved} />}
    </div>
  );
};
