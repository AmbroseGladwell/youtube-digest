import type { ReactNode } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./OnboardingAccount.module.scss";
import { onboardingAccountTestIds } from "./OnboardingAccountTestIds.js";

const WHAT_YOU_GET = [
  "Save the things you want to come back to",
  "Get the good bits in moments, to read or listen to",
  "Ask your AI about anything you’ve saved",
];

export interface OnboardingAccountProps {
  // The way in: the inline form, then the code in its place (327l, 327l-2).
  form: ReactNode;
  // Their card with its pills and answers, "Saved with your account"; null for nothing to show.
  saved: ReactNode | null;
}

// Design 327l: the account comes before anything is written, so the screen shows what they've put
// in and what they'll get beside the way in. Email only for now (docs/features/onboarding.md,
// "The account").
export function OnboardingAccount({ form, saved }: OnboardingAccountProps) {
  return (
    <div className={styles.root} data-testid={onboardingAccountTestIds.root}>
      <div className={styles.form}>{form}</div>

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
