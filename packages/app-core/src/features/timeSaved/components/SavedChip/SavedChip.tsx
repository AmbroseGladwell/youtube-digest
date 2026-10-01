import { useEffect, useState } from "react";
import { prefersReducedMotion } from "../../../../util/prefersReducedMotion.js";
import styles from "./SavedChip.module.scss";
import { savedChipTestIds } from "./SavedChipTestIds.js";

export interface SavedChipProps {
  minutes: number;
  // In an overview the number counts up from nothing; on a row it simply arrives.
  countUp?: boolean;
  leaving?: boolean;
}

const COUNT_UP_MS = 600;

function useCountUp(to: number, enabled: boolean): number {
  const [value, setValue] = useState(enabled && !prefersReducedMotion() ? 0 : to);

  useEffect(() => {
    if (!enabled || prefersReducedMotion()) {
      setValue(to);
      return;
    }
    const startedAt = performance.now();
    let frame = 0;
    const tick = (time: number) => {
      const progress = Math.min(1, (time - startedAt) / COUNT_UP_MS);
      setValue(Math.round(to * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, enabled]);

  return value;
}

// "Saved you 10 min", unwrapping beside the reading line when an overview is marked read
// (designs 34q and 34r; docs/features/time-saved.md, "Every day").
export function SavedChip({ minutes, countUp = false, leaving = false }: SavedChipProps) {
  const shown = useCountUp(minutes, countUp);

  return (
    <span className={`${styles.root} ${leaving ? styles.leaving : ""}`} role="status" data-testid={savedChipTestIds.root}>
      <span className={styles.visuallyHidden}>Saved you {minutes} min</span>
      <svg className={styles.check} aria-hidden="true" viewBox="0 0 24 24" width="12" height="12">
        <path pathLength={1} d="M20 6 9 17l-5-5" />
      </svg>
      <span className={styles.text} aria-hidden="true">
        Saved you
      </span>
      <span className={styles.number} aria-hidden="true">
        {shown} min
      </span>
    </span>
  );
}
