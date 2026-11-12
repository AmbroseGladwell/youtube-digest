import { isPaused, timeLeftMs, type CookingTimer } from "../../util/cookingTimers.js";
import { timeLeftWords, timerClock, timerFullName, timerShortName } from "../../util/timerText.js";
import { TimerRing } from "../TimerRing/TimerRing.js";
import styles from "./CookingTimerStrip.module.scss";
import { cookingTimerStripTestIds } from "./CookingTimerStripTestIds.js";

export interface CookingTimerStripProps {
  timers: readonly CookingTimer[];
  now: number;
  onOpen: (id: number) => void;
}

const timerLabel = (timer: CookingTimer, now: number): string => {
  const where = timer.name === null ? `Step ${timer.step + 1} timer` : `${timer.name} timer, step ${timer.step + 1}`;
  return `${where}, ${isPaused(timer) ? "paused, " : ""}${timeLeftWords(timeLeftMs(timer, now))} left`;
};

// Designs 284g–284o: the running timers under the step dots on every screen of the mode,
// soonest first. One is named by its verb and step; two or more by the verb alone.
export function CookingTimerStrip({ timers, now, onOpen }: CookingTimerStripProps) {
  if (timers.length === 0) return null;
  const solo = timers.length === 1;
  return (
    <div
      className={styles.strip}
      role="group"
      aria-label="Timers, soonest first"
      data-cooking-own-keys=""
      data-testid={cookingTimerStripTestIds.root}
    >
      {timers.map((timer) => {
        const left = timeLeftMs(timer, now);
        const paused = isPaused(timer);
        const name = solo ? timerFullName(timer) : timerShortName(timer);
        return (
          <button
            key={timer.id}
            type="button"
            className={`${styles.chip} ${solo ? styles.solo : ""}`}
            aria-label={timerLabel(timer, now)}
            onClick={() => onOpen(timer.id)}
            data-testid={cookingTimerStripTestIds.chip}
          >
            <TimerRing leftMs={left} totalMs={timer.totalMs} paused={paused} />
            <span className={styles.text}>
              <span className={styles.name} data-testid={cookingTimerStripTestIds.name}>
                {name}
                {paused ? " · paused" : ""}
              </span>
              <span className={styles.time} data-testid={cookingTimerStripTestIds.time}>
                {timerClock(left)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
