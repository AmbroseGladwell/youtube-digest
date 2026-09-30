import { useEffect, useRef, type ReactNode } from "react";
import type { SettingsSectionId } from "../../SettingsSectionId.js";
import styles from "./SettingsSection.module.scss";
import { settingsSectionTestIds } from "./SettingsSectionTestIds.js";

export interface SettingsSectionProps {
  id: SettingsSectionId;
  title: string;
  intro: string | null;
  focusOnArrival: boolean;
  children: ReactNode;
}

export const settingsSectionHeadingId = (section: SettingsSectionId) => `settings-section-${section}`;

export function SettingsSection({ id, title, intro, focusOnArrival, children }: SettingsSectionProps) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // The voice section scrolls the reader's voice into view itself; focus must not undo it.
    if (focusOnArrival) heading.current?.focus({ preventScroll: true });
  }, [focusOnArrival]);

  return (
    <section className={styles.root} aria-labelledby={settingsSectionHeadingId(id)} data-testid={settingsSectionTestIds.root(id)}>
      <h2
        ref={heading}
        id={settingsSectionHeadingId(id)}
        className={styles.heading}
        tabIndex={-1}
        data-testid={settingsSectionTestIds.heading(id)}
      >
        {title}
      </h2>
      {intro !== null && <p className={styles.intro}>{intro}</p>}
      {children}
    </section>
  );
}
