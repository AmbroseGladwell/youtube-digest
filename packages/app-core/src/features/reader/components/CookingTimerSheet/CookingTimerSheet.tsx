import { useEffect, useRef, type ReactNode } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { isPaused, timeLeftMs, type CookingTimer } from "../../util/cookingTimers.js";
import { timerAtClock, timerClock, timerFullName, timerLength, timerSpokenName } from "../../util/timerText.js";
import styles from "./CookingTimerSheet.module.scss";
import { cookingTimerSheetTestIds } from "./CookingTimerSheetTestIds.js";

export interface CookingTimerSheetProps {
  timer: CookingTimer | null;
  now: number;
  onPause: (id: number) => void;
  onResume: (id: number) => void;
  onAdjust: (id: number, minutes: number) => void;
  onCancel: (id: number) => void;
  onClose: () => void;
  // Outside the mode, or a recipe other than the one being cooked (OV-288, design 288s).
  recipeTitle?: string | null;
  wayBack?: ReactNode;
}

// Designs 284q and 284r (owner, 12 Nov 2026): a running timer's own sheet, with Pause or Resume,
// −1 min and +1 min in one row, and Cancel timer set apart under them.
export function CookingTimerSheet({
  timer,
  now,
  onPause,
  onResume,
  onAdjust,
  onCancel,
  onClose,
  recipeTitle = null,
  wayBack = null,
}: CookingTimerSheetProps) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const open = timer !== null;

  useEffect(() => {
    const element = dialog.current;
    if (element === null) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  const left = timer === null ? 0 : timeLeftMs(timer, now);
  const paused = timer !== null && isPaused(timer);
  const length = timer === null ? "" : timerLength(Math.round(timer.totalMs / 1000));

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-label={timer === null ? undefined : timerSpokenName(timer)}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      data-testid={cookingTimerSheetTestIds.root}
    >
      {timer !== null && (
        <div className={styles.panel}>
          <span className={styles.handle} aria-hidden="true" />
          <div className={styles.head}>
            <span className={styles.titles}>
              <h2 className={styles.heading}>{timerFullName(timer)}</h2>
              {recipeTitle !== null && (
                <span className={styles.recipe} data-testid={cookingTimerSheetTestIds.recipe}>
                  {recipeTitle}
                </span>
              )}
            </span>
            <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
              <StrokeIcon name="close" size={16} />
            </button>
          </div>
          <p className={styles.clock} data-testid={cookingTimerSheetTestIds.clock}>
            {timerClock(left)}
          </p>
          <p className={styles.line} data-testid={cookingTimerSheetTestIds.line}>
            {paused ? `paused · left of ${length}` : `left of ${length} · rings at ${timerAtClock(now + left)}`}
          </p>
          <div className={styles.row}>
            <button
              type="button"
              className={styles.control}
              onClick={() => (paused ? onResume(timer.id) : onPause(timer.id))}
              data-testid={cookingTimerSheetTestIds.pause}
            >
              <StrokeIcon name={paused ? "play" : "pause"} size={18} />
              {paused ? "Resume" : "Pause"}
            </button>
            <button
              type="button"
              className={styles.control}
              aria-label="One minute less"
              onClick={() => onAdjust(timer.id, -1)}
              data-testid={cookingTimerSheetTestIds.less}
            >
              −1 min
            </button>
            <button
              type="button"
              className={styles.control}
              aria-label="One more minute"
              onClick={() => onAdjust(timer.id, 1)}
              data-testid={cookingTimerSheetTestIds.more}
            >
              +1 min
            </button>
          </div>
          {wayBack}
          <button type="button" className={styles.cancel} onClick={() => onCancel(timer.id)} data-testid={cookingTimerSheetTestIds.cancel}>
            Cancel timer
          </button>
        </div>
      )}
    </dialog>
  );
}
