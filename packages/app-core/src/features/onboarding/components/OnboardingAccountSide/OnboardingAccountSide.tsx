import type { ReactNode } from "react";
import { StrokeIcon, type StrokeIconName } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./OnboardingAccountSide.module.scss";

const WHAT_YOU_GET: { icon: StrokeIconName; line: string }[] = [
  { icon: "openOut", line: "Save the things you want to come back to" },
  { icon: "fileText", line: "Get the good bits in moments, to read or listen to" },
  { icon: "chat", line: "Ask your AI about anything you’ve saved" },
];

// Design 327l: beside the way in, their card as it will be saved, and what the account gives them.
export const OnboardingAccountSide = ({ saved }: { saved: ReactNode | null }) => {
  return (
    <aside className={styles.root}>
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
          {WHAT_YOU_GET.map(({ icon, line }) => (
            <li key={line}>
              <span className={styles.tile} aria-hidden="true">
                <StrokeIcon name={icon} size={14} />
              </span>
              {line}
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
};
