import { useEffect, useRef, type ReactNode } from "react";
import styles from "./OnboardingHeading.module.scss";

export const ONBOARDING_HEADING_ID = "onboarding-heading";

// Every screen's heading, which takes focus as the screen arrives (the brief's accessibility).
export function OnboardingHeading({ children }: { children: ReactNode }) {
  const heading = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <h1 id={ONBOARDING_HEADING_ID} className={styles.root} ref={heading} tabIndex={-1}>
      {children}
    </h1>
  );
}
