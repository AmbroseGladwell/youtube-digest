import { useEffect, useRef, type ReactNode } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import type { CookingTimer } from "../../util/cookingTimers.js";
import { countWord, timerAgo, timerLength, timerShortName, timerSpokenName } from "../../util/timerText.js";
import styles from "./CookingTimerBanner.module.scss";
import { cookingTimerBannerTestIds } from "./CookingTimerBannerTestIds.js";

export interface CookingTimerBannerProps {
  ringing: readonly CookingTimer[];
  now: number;
  onDismiss: (id: number) => void;
  onMore: (id: number) => void;
  dismissKey: ReactNode;
}

const detail = (timer: CookingTimer, now: number) =>
  `Step ${timer.step + 1} · ${timerLength(timer.source.seconds)} · ${timerAgo(now - (timer.rangAt ?? now))}`;

// Designs 284s–284w: a banner in the strip's place on whatever step the reader is on, its edge
// pulsing, with Dismiss and +1 min; two or more ringing get a row each, oldest first. Focus
// moves to the first Dismiss when one starts.
export function CookingTimerBanner({ ringing, now, onDismiss, onMore, dismissKey }: CookingTimerBannerProps) {
  const firstDismiss = useRef<HTMLButtonElement | null>(null);
  const newest = ringing.reduce((latest, timer) => Math.max(latest, timer.id), 0);

  useEffect(() => {
    if (newest > 0) firstDismiss.current?.focus({ preventScroll: true });
  }, [newest]);

  if (ringing.length === 0) return null;
  const only = ringing.length === 1 ? ringing[0]! : null;

  return (
    <div className={styles.banner} role="alert" data-cooking-own-keys="" data-testid={cookingTimerBannerTestIds.root}>
      <div className={styles.head}>
        <span className={styles.bell} aria-hidden="true">
          <StrokeIcon name="bell" size={20} />
        </span>
        <span className={styles.headText}>
          <b data-testid={cookingTimerBannerTestIds.title}>
            {only === null ? `${countWord(ringing.length)} timers are done` : `${timerSpokenName(only)} is done`}
          </b>
          <small>{only === null ? "Oldest first" : detail(only, now)}</small>
        </span>
      </div>
      {only === null ? (
        ringing.map((timer, index) => (
          <div key={timer.id} className={styles.row} data-testid={cookingTimerBannerTestIds.row}>
            <span className={styles.rowText}>
              <b>{timerShortName(timer)}</b>
              <small>{detail(timer, now)}</small>
            </span>
            <button
              type="button"
              className={styles.more}
              aria-label={`${timerShortName(timer)}: one more minute`}
              onClick={() => onMore(timer.id)}
              data-testid={cookingTimerBannerTestIds.more}
            >
              +1 min
            </button>
            <button
              type="button"
              ref={index === 0 ? firstDismiss : undefined}
              className={styles.dismiss}
              aria-label={`Dismiss ${timerShortName(timer).toLowerCase()} timer`}
              onClick={() => onDismiss(timer.id)}
              data-testid={cookingTimerBannerTestIds.dismiss}
            >
              Dismiss
            </button>
          </div>
        ))
      ) : (
        <div className={styles.buttons}>
          <button
            type="button"
            ref={firstDismiss}
            className={styles.dismiss}
            onClick={() => onDismiss(only.id)}
            data-testid={cookingTimerBannerTestIds.dismiss}
          >
            Dismiss
            {dismissKey}
          </button>
          <button
            type="button"
            className={styles.more}
            aria-label="One more minute"
            onClick={() => onMore(only.id)}
            data-testid={cookingTimerBannerTestIds.more}
          >
            +1 min
          </button>
        </div>
      )}
    </div>
  );
}
