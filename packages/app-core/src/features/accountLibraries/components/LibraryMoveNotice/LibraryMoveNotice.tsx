import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";
import { useLibraryMove } from "../../LibraryMoveContext.js";
import { libraryMoveCopy } from "../../util/libraryMoveCopy.js";
import styles from "./LibraryMoveNotice.module.scss";
import { libraryMoveNoticeTestIds } from "./LibraryMoveNoticeTestIds.js";

// Design 47e: told once, after the fact, in the strip slot. It goes by itself after ten
// seconds, the bar running down and holding while the pointer or focus is on it, or with ×.
export function LibraryMoveNotice({ panel = false }: { panel?: boolean }) {
  const { move, dismiss } = useLibraryMove();
  const analytics = useAnalytics();
  if (move === null) return null;
  const copy = libraryMoveCopy(move);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`${styles.root} ${panel ? styles.panel : ""}`}
      data-testid={libraryMoveNoticeTestIds.root}
    >
      <span className={styles.text}>
        <span className={styles.icon}>
          <StrokeIcon name="check" size={16} />
        </span>
        <span className={styles.words}>
          <span className={styles.lead} data-testid={libraryMoveNoticeTestIds.lead}>
            {copy.lead}
          </span>
          {copy.then !== null && (
            <>
              {" "}
              <span className={styles.then} data-testid={libraryMoveNoticeTestIds.then}>
                {copy.then}
              </span>
            </>
          )}
        </span>
      </span>
      <button
        type="button"
        className={styles.dismiss}
        onClick={() => {
          analytics.account.movedNotice.dismissed();
          dismiss();
        }}
        aria-label="Dismiss"
        data-testid={libraryMoveNoticeTestIds.dismiss}
      >
        <StrokeIcon name="close" size={16} />
      </button>
      <span className={styles.timer} aria-hidden="true">
        <span className={styles.timerBar} onAnimationEnd={dismiss} />
      </span>
    </div>
  );
}
