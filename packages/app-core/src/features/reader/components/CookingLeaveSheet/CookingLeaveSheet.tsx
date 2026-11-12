import { useEffect, useRef, type ReactNode } from "react";
import { isPaused, timeLeftMs, type CookingTimer } from "../../util/cookingTimers.js";
import { countWord, timeLeftWords, timerClock, timerFullName, timerSpokenName } from "../../util/timerText.js";
import { TimerRing } from "../TimerRing/TimerRing.js";
import styles from "./CookingLeaveSheet.module.scss";
import { cookingLeaveSheetTestIds } from "./CookingLeaveSheetTestIds.js";

export interface CookingLeaveSheetProps {
  open: boolean;
  timers: readonly CookingTimer[];
  now: number;
  web: boolean;
  keepKey: ReactNode;
  onKeep: () => void;
  onLeave: () => void;
}

const sentence = (timers: readonly CookingTimer[], now: number): string => {
  const only = timers.length === 1 ? timers[0]! : null;
  if (only === null) return `${countWord(timers.length)} timers are running. Leaving stops them all.`;
  return `Your ${timerSpokenName(only).toLowerCase()} has ${timeLeftWords(timeLeftMs(only, now))} left. Leaving stops it.`;
};

// Designs 284x–284aa: leaving with a timer running asks first. Keep cooking is first, filled and
// focused, and Esc means it. A sheet on the phone and in the panel, a dialog on the web.
export function CookingLeaveSheet({ open, timers, now, web, keepKey, onKeep, onLeave }: CookingLeaveSheetProps) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const keep = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element === null) return;
    if (open && !element.open) {
      element.showModal();
      keep.current?.focus();
    }
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className={`${styles.dialog} ${web ? styles.web : ""}`}
      role="alertdialog"
      aria-label="Leave cooking mode?"
      onCancel={(event) => {
        event.preventDefault();
        onKeep();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onKeep();
      }}
      data-testid={cookingLeaveSheetTestIds.root}
    >
      {open && (
        <div className={styles.panel}>
          <span className={styles.handle} aria-hidden="true" />
          <h2 className={styles.heading}>Leave cooking mode?</h2>
          <p className={styles.sentence} data-testid={cookingLeaveSheetTestIds.sentence}>
            {sentence(timers, now)}
          </p>
          {timers.length > 1 && (
            <ul className={styles.list}>
              {timers.map((timer) => {
                const left = timeLeftMs(timer, now);
                return (
                  <li key={timer.id} className={styles.item} data-testid={cookingLeaveSheetTestIds.timer}>
                    <TimerRing leftMs={left} totalMs={timer.totalMs} paused={isPaused(timer)} size={26} />
                    <span>{timerFullName(timer)}</span>
                    <b>{timerClock(left)}</b>
                  </li>
                );
              })}
            </ul>
          )}
          <div className={styles.buttons}>
            <button type="button" ref={keep} className={styles.keep} onClick={onKeep} data-testid={cookingLeaveSheetTestIds.keep}>
              Keep cooking
              {keepKey}
            </button>
            <button type="button" className={styles.leave} onClick={onLeave} data-testid={cookingLeaveSheetTestIds.leave}>
              Leave
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
