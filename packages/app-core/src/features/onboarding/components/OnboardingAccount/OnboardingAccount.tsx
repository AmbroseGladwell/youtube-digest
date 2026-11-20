import type { ReactNode } from "react";
import type { AuthIntent } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { OnboardingHeading } from "../OnboardingHeading/OnboardingHeading.js";
import styles from "./OnboardingAccount.module.scss";
import { onboardingAccountTestIds } from "./OnboardingAccountTestIds.js";

const WHAT_YOU_GET = [
  "Save the things you want to come back to",
  "Get the good bits in moments, to read or listen to",
  "Ask your AI about anything you’ve saved",
];

export interface OnboardingAccountProps {
  // Their card with its pills and answers, "Saved with your account"; null for nothing to show.
  saved: ReactNode | null;
  onChoose: (way: AuthIntent) => void;
}

// Design 327l: the account comes before anything is written, so the screen shows what they've put
// in and what they'll get, then the way in, with the reassurance right under it. Email only for now
// (docs/features/onboarding.md, "The account").
export function OnboardingAccount({ saved, onChoose }: OnboardingAccountProps) {
  return (
    <div className={styles.root} data-testid={onboardingAccountTestIds.root}>
      <div className={styles.form}>
        <OnboardingHeading>Create your free account to get your overview.</OnboardingHeading>
        <div className={styles.ways}>
          <button
            type="button"
            className={styles.way}
            onClick={() => onChoose("createAccount")}
            data-testid={onboardingAccountTestIds.continueWithEmail}
          >
            <StrokeIcon name="mail" size={17} />
            Continue with email
          </button>
          <p className={styles.reassurance} data-testid={onboardingAccountTestIds.reassurance}>
            <StrokeIcon name="check" size={14} />
            No card needed. Free includes 5 overviews a month.
          </p>
        </div>
        <button type="button" className={styles.quiet} onClick={() => onChoose("signIn")} data-testid={onboardingAccountTestIds.signIn}>
          Already have an account? Sign in
        </button>
      </div>

      <aside className={styles.side}>
        {saved !== null && (
          <section className={styles.saved} aria-label="Saved with your account">
            <span className={styles.label}>Saved with your account</span>
            {saved}
          </section>
        )}
        <section className={styles.get} aria-labelledby="onboarding-what-you-get">
          <span id="onboarding-what-you-get" className={styles.label}>
            What you get
          </span>
          <ul className={styles.list}>
            {WHAT_YOU_GET.map((line) => (
              <li key={line}>
                <StrokeIcon name="check" size={14} />
                {line}
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
