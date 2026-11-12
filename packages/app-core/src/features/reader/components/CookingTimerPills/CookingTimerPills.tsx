import { Fragment, type ReactNode, type Ref } from "react";
import type { MethodTime } from "@overview/domain";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import type { CookingTimer, CookingTimerSource } from "../../util/cookingTimers.js";
import { timerLength, timerLengthWords } from "../../util/timerText.js";
import styles from "./CookingTimerPills.module.scss";
import { cookingTimerPillsTestIds } from "./CookingTimerPillsTestIds.js";

export interface CookingTimerPillsProps {
  times: readonly MethodTime[];
  action: number;
  runningFrom: (source: CookingTimerSource) => CookingTimer | undefined;
  onStart: (time: MethodTime, index: number, seconds: number) => void;
  onOpen: (id: number) => void;
  firstPill: Ref<HTMLButtonElement>;
  firstKey: ReactNode;
}

// Designs 284a–284f: a "Start a timer" row under the action, one pill per time, a range as its
// two ends with "or" between, and a started pill shown as running.
export function CookingTimerPills({ times, action, runningFrom, onStart, onOpen, firstPill, firstKey }: CookingTimerPillsProps) {
  if (times.length === 0) return null;
  const named = times.length > 1;
  const range = times.some((time) => time.seconds.length > 1);
  let first = true;

  const pill = (time: MethodTime, index: number, seconds: number) => {
    const running = runningFrom({ action, time: index, seconds });
    const verb = named && time.name !== null ? time.name : null;
    const label = `${verb === null ? "" : `${verb} · `}${timerLength(seconds)}`;
    const isFirst = first;
    first = false;
    return running === undefined ? (
      <button
        type="button"
        ref={isFirst ? firstPill : undefined}
        className={styles.pill}
        aria-label={`Start a ${timerLengthWords(seconds)}${verb === null ? "" : ` ${verb.toLowerCase()}`} timer`}
        onClick={() => onStart(time, index, seconds)}
        data-testid={cookingTimerPillsTestIds.start}
      >
        <StrokeIcon name="timer" size={18} />
        {label}
        {isFirst && firstKey}
      </button>
    ) : (
      <button
        type="button"
        ref={isFirst ? firstPill : undefined}
        className={`${styles.pill} ${styles.running}`}
        aria-label={`${label} timer, running`}
        onClick={() => onOpen(running.id)}
        data-testid={cookingTimerPillsTestIds.running}
      >
        <StrokeIcon name="timer" size={18} />
        {label} · running
        {isFirst && firstKey}
      </button>
    );
  };

  return (
    <div className={styles.root} data-cooking-own-keys="" data-testid={cookingTimerPillsTestIds.root}>
      <b className={styles.heading}>{range ? "Start a timer, either end" : "Start a timer"}</b>
      <div className={styles.row} role="group" aria-label="Timers in this step">
        {times.map((time, index) => (
          <Fragment key={index}>
            {time.seconds.map((seconds, end) => (
              <Fragment key={end}>
                {end > 0 && <span className={styles.or}>or</span>}
                {pill(time, index, seconds)}
              </Fragment>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
