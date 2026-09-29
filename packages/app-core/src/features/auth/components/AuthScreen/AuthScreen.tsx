import { useEffect, useRef, type ReactNode } from "react";
import { useIsPanel } from "../../../../app/LayoutContext.js";
import { StrokeIcon, type StrokeIconName } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./AuthScreen.module.scss";
import { authScreenTestIds } from "./AuthScreenTestIds.js";

export interface AuthScreenProps {
  title: string;
  icon?: StrokeIconName | undefined;
  kicker?: string | undefined;
  lead?: ReactNode;
  compactTitle?: boolean;
  testId?: string | undefined;
  children?: ReactNode;
}

// Design 9's one column and 10's panel: every step of signing in is this screen with a
// different heading, so the heading takes focus whenever a step arrives.
export function AuthScreen({ title, icon, kicker, lead, compactTitle = false, testId, children }: AuthScreenProps) {
  const isPanel = useIsPanel();
  const heading = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    heading.current?.focus();
  }, [title]);

  return (
    <div className={`${styles.root} ${isPanel ? styles.panel : ""}`} data-testid={testId}>
      <div className={styles.column}>
        {icon !== undefined && (
          <span className={styles.badge}>
            <StrokeIcon name={icon} size={isPanel ? 20 : 22} />
          </span>
        )}
        {kicker !== undefined && (
          <p className={styles.kicker} data-testid={authScreenTestIds.kicker}>
            {kicker}
          </p>
        )}
        <h2
          className={`${styles.title} ${compactTitle ? styles.titleCompact : ""}`}
          ref={heading}
          tabIndex={-1}
          data-testid={authScreenTestIds.title}
        >
          {title}
        </h2>
        {lead !== undefined && (
          <p className={styles.lead} data-testid={authScreenTestIds.lead}>
            {lead}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
