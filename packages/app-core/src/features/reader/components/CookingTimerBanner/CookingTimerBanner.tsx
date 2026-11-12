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
  // The recipe being cooked; a timer from any other, or any timer outside the mode (null), is
  // named by its recipe (design 288w).
  here?: string | null;
}

const detail = (timer: CookingTimer, now: number, here: string | null) =>
  timer.source.recipe === here
    ? `Step ${timer.step + 1} · ${timerLength(timer.source.seconds)} · ${timerAgo(now - (timer.rangAt ?? now))}`
    : `${timer.recipeTitle} · step ${timer.step + 1} · ${timerLength(timer.source.seconds)}`;

// Designs 284s–284w: a banner in the strip's place on whatever step the reader is on, its edge
// pulsing, with Dismiss and +1 min; two or more ringing get a row each, oldest first. Focus
// moves to the first Dismiss when one starts, to the next Dismiss as each is answered, and to
// the cooking screen itself once none ring, so Space and the arrows move on again. Outside the
// mode it goes back to wherever it was before the ring (design 288y).
export function CookingTimerBanner({ ringing, now, onDismiss, onMore, dismissKey, here = null }: CookingTimerBannerProps) {
  const firstDismiss = useRef<HTMLButtonElement | null>(null);
  const screen = useRef<HTMLElement | null>(null);
  const before = useRef<Element | null>(null);
  const newest = ringing.reduce((latest, timer) => Math.max(latest, timer.id), 0);
  const ids = ringing.map((timer) => timer.id).join(" ");

  useEffect(() => {
    const button = firstDismiss.current;
    if (newest === 0 || button === null) return;
    screen.current = button.closest("dialog");
    if (!button.closest("[role=alert]")?.contains(document.activeElement)) before.current = document.activeElement;
    button.focus({ preventScroll: true });
  }, [newest]);

  useEffect(() => {
    const active = document.activeElement;
    if (active !== null && active !== document.body) return;
    if (firstDismiss.current !== null || screen.current !== null) {
      (firstDismiss.current ?? screen.current)?.focus({ preventScroll: true });
      return;
    }
    const back = before.current;
    before.current = null;
    if (back instanceof HTMLElement && back.isConnected) back.focus({ preventScroll: true });
  }, [ids]);

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
          <small>{only === null ? "Oldest first" : detail(only, now, here)}</small>
        </span>
      </div>
      {only === null ? (
        ringing.map((timer, index) => (
          <div key={timer.id} className={styles.row} data-testid={cookingTimerBannerTestIds.row}>
            <span className={styles.rowText}>
              <b>{timerShortName(timer)}</b>
              <small>{detail(timer, now, here)}</small>
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
