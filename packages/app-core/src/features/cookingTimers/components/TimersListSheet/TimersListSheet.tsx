import { useEffect, useRef } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
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

// Design 288p: four or more timers, folded at the foot, listed soonest first, each named by its
// step and recipe and opening its own controls.
export function TimersListSheet({ open, onOpen, onClose }: TimersListSheetProps) {
  const { running, now } = useCookingTimers();
  const dialog = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element === null) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-label={`Timers, ${running.length}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
      data-testid={timersListSheetTestIds.root}
    >
      {open && (
        <div className={styles.panel}>
          <span className={styles.handle} aria-hidden="true" />
          <div className={styles.head}>
            <h2 className={styles.heading}>Timers · {running.length}</h2>
            <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
              <StrokeIcon name="close" size={16} />
            </button>
          </div>
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
      )}
    </dialog>
  );
}
