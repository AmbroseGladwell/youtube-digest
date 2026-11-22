import { useEffect, useRef, type ReactNode } from "react";
import { useIsPanel } from "../../../../app/LayoutContext.js";
import styles from "./OnboardingHeading.module.scss";

export const ONBOARDING_HEADING_ID = "onboarding-heading";

export interface OnboardingHeadingProps {
  children: ReactNode;
  small?: boolean;
}

export const OnboardingHeading = ({ children, small = false }: OnboardingHeadingProps) => {
  const heading = useRef<HTMLHeadingElement | null>(null);
  const isPanel = useIsPanel();
  useEffect(() => heading.current?.focus(), []);
  return (
    <h1
      id={ONBOARDING_HEADING_ID}
      className={small ? styles.small : `${styles.root} ${isPanel ? styles.panel : ""}`}
      ref={heading}
      tabIndex={-1}
    >
      {children}
    </h1>
  );
};
