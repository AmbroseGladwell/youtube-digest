import { useEffect, useRef, type ReactNode } from "react";
import { isPaused, timeLeftMs, type CookingTimer } from "../../util/cookingTimers.js";
import { countWord, timerClock, timerFullName, timerSpokenName } from "../../util/timerText.js";
import { TimerRing } from "../TimerRing/TimerRing.js";
import styles from "./CookingLeaveSheet.module.scss";
import { cookingLeaveSheetTestIds } from "./CookingLeaveSheetTestIds.js";

export interface CookingLeaveSheetProps {
  open: boolean;
  // This recipe's timers; another recipe's carry on whatever is chosen here.
  running: readonly CookingTimer[];
  ringing: readonly CookingTimer[];
  others: readonly CookingTimer[];
  now: number;
  web: boolean;
  stayKey: ReactNode;
  onStay: () => void;
  onKeep: () => void;
  onStop: () => void;
}

const lower = (timer: CookingTimer) => timerSpokenName(timer).toLowerCase();

const headingFor = (running: readonly CookingTimer[], ringing: readonly CookingTimer[]): string => {
  if (running.length === 0)
    return ringing.length === 1 ? `The ${lower(ringing[0]!)} is ringing` : `${countWord(ringing.length)} timers are ringing`;
  if (running.length === 1) return `Keep the ${lower(running[0]!)} running?`;
  if (running.length === 2) return "Keep both timers running?";
  return `Keep all ${countWord(running.length).toLowerCase()} timers running?`;
};

const sentenceFor = (running: readonly CookingTimer[], ringing: readonly CookingTimer[], now: number): string => {
  if (running.length === 0) {
    return ringing.length === 1
      ? "Dismiss it now, or keep it ringing beside the player until you do."
      : "Dismiss them now, or keep them ringing beside the player until you do.";
  }
  if (running.length > 1) return "They carry on beside the player while you read, and ring wherever you are in the app.";
  return `${timerClock(timeLeftMs(running[0]!, now))} left. It carries on beside the player while you read, and rings wherever you are in the app.`;
};

const othersLine = (others: readonly CookingTimer[]): string | null => {
  if (others.length === 0) return null;
  if (others.length > 1) return "Your other recipes’ timers carry on either way.";
  return `Your ${lower(others[0]!)} for ${others[0]!.recipeTitle} carries on either way.`;
};

// Designs 288a–288f: leaving with this recipe's timers running asks whether to keep them, since
// they now carry on outside the mode. Keep running is filled and focused; Stop is the one that
// loses something; Keep cooking is quiet, and Esc means it. With only a ringing timer, the choice
// is Dismiss and leave or Keep it ringing. A sheet on the phone and in the panel, a dialog on the web.
export function CookingLeaveSheet({ open, running, ringing, others, now, web, stayKey, onStay, onKeep, onStop }: CookingLeaveSheetProps) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const first = useRef<HTMLButtonElement | null>(null);
  const onlyRinging = running.length === 0;
  const heading = headingFor(running, ringing);
  const othersText = othersLine(others);

  useEffect(() => {
    const element = dialog.current;
    if (element === null) return;
    if (open && !element.open) {
      element.showModal();
      first.current?.focus();
    }
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className={`${styles.dialog} ${web ? styles.web : ""}`}
      role="alertdialog"
      aria-label={heading}
      onCancel={(event) => {
        event.preventDefault();
        onStay();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onStay();
      }}
      data-testid={cookingLeaveSheetTestIds.root}
    >
      {open && (
        <div className={styles.panel}>
          <span className={styles.handle} aria-hidden="true" />
          <h2 className={styles.heading} data-testid={cookingLeaveSheetTestIds.heading}>
            {heading}
          </h2>
          <p className={styles.sentence} data-testid={cookingLeaveSheetTestIds.sentence}>
            {sentenceFor(running, ringing, now)}
          </p>
          {running.length > 1 && (
            <ul className={styles.list}>
              {running.map((timer) => {
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
          {othersText !== null && (
            <p className={styles.others} data-testid={cookingLeaveSheetTestIds.others}>
              {othersText}
            </p>
          )}
          <div className={styles.buttons}>
            <button
              type="button"
              ref={first}
              className={styles.keep}
              onClick={onlyRinging ? onStop : onKeep}
              data-testid={onlyRinging ? cookingLeaveSheetTestIds.stop : cookingLeaveSheetTestIds.keep}
            >
              {onlyRinging ? "Dismiss and leave" : "Keep running"}
            </button>
            <button
              type="button"
              className={styles.leave}
              onClick={onlyRinging ? onKeep : onStop}
              data-testid={onlyRinging ? cookingLeaveSheetTestIds.keep : cookingLeaveSheetTestIds.stop}
            >
              {onlyRinging
                ? ringing.length === 1
                  ? "Keep it ringing"
                  : "Keep them ringing"
                : running.length === 1
                  ? "Stop timer"
                  : "Stop timers"}
            </button>
            <button type="button" className={styles.stay} onClick={onStay} data-testid={cookingLeaveSheetTestIds.stay}>
              Keep cooking
              {stayKey}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
