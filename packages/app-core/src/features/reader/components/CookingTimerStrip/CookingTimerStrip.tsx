import { isPaused, timeLeftMs, type CookingTimer } from "../../util/cookingTimers.js";
import { timeLeftWords, timerClock, timerFullName, timerShortName } from "../../util/timerText.js";
import { TimerRing } from "../TimerRing/TimerRing.js";
import styles from "./CookingTimerStrip.module.scss";
import { cookingTimerStripTestIds } from "./CookingTimerStripTestIds.js";

export interface CookingTimerStripProps {
  timers: readonly CookingTimer[];
  now: number;
  // The recipe being cooked; another recipe's timers are named by their recipe.
  here: string;
  onOpen: (id: number) => void;
}

const timerLabel = (timer: CookingTimer, now: number, here: string): string => {
  const step = timer.name === null ? `Step ${timer.step + 1} timer` : `${timer.name} timer, step ${timer.step + 1}`;
  const where = timer.source.recipe === here ? step : `${step}, ${timer.recipeTitle}`;
  return `${where}, ${isPaused(timer) ? "paused, " : ""}${timeLeftWords(timeLeftMs(timer, now))} left`;
};

const chipName = (timer: CookingTimer, here: string, solo: boolean): string => {
  if (timer.source.recipe !== here) {
    return `${timerShortName(timer)} · ${timer.recipeTitle}`;
  }
  return solo ? timerFullName(timer) : timerShortName(timer);
};

export const CookingTimerStrip = ({ timers, now, here, onOpen }: CookingTimerStripProps) => {
  if (timers.length === 0) {
    return null;
  }
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
        const name = chipName(timer, here, solo);
        return (
          <button
            key={timer.id}
            type="button"
            className={`${styles.chip} ${solo ? styles.solo : ""}`}
            aria-label={timerLabel(timer, now, here)}
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
};
