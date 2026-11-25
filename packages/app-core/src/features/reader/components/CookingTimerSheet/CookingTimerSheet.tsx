import type { ReactNode } from "react";
import { BottomSheet } from "../../../../components/shared/BottomSheet/BottomSheet.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useKeptWhileClosing } from "../../../../util/useKeptWhileClosing.js";
import { isPaused, timeLeftMs, type CookingTimer } from "../../util/cookingTimers.js";
import { timerAtClock, timerClock, timerFullName, timerLength, timerSpokenName } from "../../util/timerText.js";
import styles from "./CookingTimerSheet.module.scss";
import { cookingTimerSheetTestIds } from "./CookingTimerSheetTestIds.js";

export interface CookingTimerSheetProps {
  timer: CookingTimer | null;
  // When the owner keeps its own timer while closing; otherwise open while there's a timer.
  open?: boolean;
  now: number;
  onPause: (id: number) => void;
  onResume: (id: number) => void;
  onAdjust: (id: number, minutes: number) => void;
  onCancel: (id: number) => void;
  onClose: () => void;
  // Given outside the mode, or for a recipe other than the one being cooked.
  recipeTitle?: string | null;
  wayBack?: ReactNode;
}

export const CookingTimerSheet = ({
  timer: given,
  open: openGiven,
  now,
  onPause,
  onResume,
  onAdjust,
  onCancel,
  onClose,
  recipeTitle = null,
  wayBack = null,
}: CookingTimerSheetProps) => {
  const kept = useKeptWhileClosing(given);
  const timer = kept.kept;
  const open = openGiven ?? kept.open;
  const left = timer === null ? 0 : timeLeftMs(timer, now);
  const paused = timer !== null && isPaused(timer);
  const length = timer === null ? "" : timerLength(Math.round(timer.totalMs / 1000));

  return (
    <BottomSheet
      open={open && timer !== null}
      title={timer === null ? "Timer" : timerSpokenName(timer)}
      onClose={onClose}
      wide="dialog"
      testId={cookingTimerSheetTestIds.root}
      head={
        timer !== null && (
          <span className={styles.titles}>
            <h2 className={styles.heading}>{timerFullName(timer)}</h2>
            {recipeTitle !== null && (
              <span className={styles.recipe} data-testid={cookingTimerSheetTestIds.recipe}>
                {recipeTitle}
              </span>
            )}
          </span>
        )
      }
      foot={
        timer !== null && (
          <button type="button" className={styles.cancel} onClick={() => onCancel(timer.id)} data-testid={cookingTimerSheetTestIds.cancel}>
            Cancel timer
          </button>
        )
      }
    >
      {timer !== null && (
        <div className={styles.content}>
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
              onClick={() => {
                if (paused) {
                  onResume(timer.id);
                } else {
                  onPause(timer.id);
                }
              }}
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
        </div>
      )}
    </BottomSheet>
  );
};
