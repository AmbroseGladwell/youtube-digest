import { BottomSheet } from "../../../../components/shared/BottomSheet/BottomSheet.js";
import { TimerRing } from "../../../reader/components/TimerRing/TimerRing.js";
import { isPaused, timeLeftMs } from "../../../reader/util/cookingTimers.js";
import { timerClock, timerFullName } from "../../../reader/util/timerText.js";
import { useCookingTimers } from "../../CookingTimersContext.js";
import styles from "./TimersListSheet.module.scss";
import { timersListSheetTestIds } from "./TimersListSheetTestIds.js";

export interface TimersListSheetProps {
  open: boolean;
  onOpen: (id: number) => void;
  onClose: () => void;
}

export const TimersListSheet = ({ open, onOpen, onClose }: TimersListSheetProps) => {
  const { running, now } = useCookingTimers();

  return (
    <BottomSheet open={open} title={`Timers · ${running.length}`} onClose={onClose} wide="dialog" testId={timersListSheetTestIds.root}>
      <div className={styles.content}>
        <ul className={styles.list}>
          {running.map((timer) => {
            const left = timeLeftMs(timer, now);
            return (
              <li key={timer.id}>
                <button type="button" className={styles.item} onClick={() => onOpen(timer.id)} data-testid={timersListSheetTestIds.item}>
                  <TimerRing leftMs={left} totalMs={timer.totalMs} paused={isPaused(timer)} size={30} />
                  <span className={styles.words}>
                    <b>{timerFullName(timer)}</b>
                    <small>{timer.recipeTitle}</small>
                  </span>
                  <span className={styles.time}>{timerClock(left)}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className={styles.note}>Soonest first. Tap one for its controls and the way back to its step.</p>
      </div>
    </BottomSheet>
  );
};
