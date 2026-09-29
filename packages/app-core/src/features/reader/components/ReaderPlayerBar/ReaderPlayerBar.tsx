import { FavouriteIcon } from "../../../../components/shared/FavouriteIcon/FavouriteIcon.js";
import { PlayPauseIcon } from "../../../../components/shared/PlayPauseIcon/PlayPauseIcon.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import styles from "./ReaderPlayerBar.module.scss";
import { readerPlayerBarTestIds } from "./ReaderPlayerBarTestIds.js";

export interface ReaderPlayerBarProps {
  playing: boolean;
  elapsed: string;
  total: string;
  progressPercent: number;
  rateLabel: string;
  currentSection: string;
  // Design 1b: the panel's bar carries the favourite, since its head has no room for it;
  // the web's head has it and the bar does not (design 1a).
  favourite: { on: boolean; onToggle: () => void } | null;
  onTogglePlaying: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onCycleRate: () => void;
}

export function ReaderPlayerBar({
  playing,
  elapsed,
  total,
  progressPercent,
  rateLabel,
  currentSection,
  favourite,
  onTogglePlaying,
  onPrevious,
  onNext,
  onCycleRate,
}: ReaderPlayerBarProps) {
  return (
    <div className={styles.root} data-testid={readerPlayerBarTestIds.root}>
      <div className={styles.transport}>
        <button
          type="button"
          className={styles.step}
          onClick={onPrevious}
          aria-label="Previous line"
          data-testid={readerPlayerBarTestIds.previousButton}
        >
          <StrokeIcon name="skipBack" size={16} />
        </button>
        <button
          type="button"
          className={styles.play}
          onClick={onTogglePlaying}
          aria-pressed={playing}
          aria-label={playing ? "Pause" : "Play"}
          data-testid={readerPlayerBarTestIds.playButton}
        >
          <PlayPauseIcon playing={playing} />
        </button>
        <button
          type="button"
          className={styles.step}
          onClick={onNext}
          aria-label="Next line"
          data-testid={readerPlayerBarTestIds.nextButton}
        >
          <StrokeIcon name="skipForward" size={16} />
        </button>
      </div>

      <div className={styles.middle}>
        <div className={styles.meta}>
          <strong className={styles.nowReading} data-testid={readerPlayerBarTestIds.nowReading}>
            Now reading · {currentSection}
          </strong>
          <span className={styles.clocks}>
            <span data-testid={readerPlayerBarTestIds.elapsed}>{elapsed}</span>
            <span className={styles.clockDivider}> / </span>
            <span data-testid={readerPlayerBarTestIds.total}>{total}</span>
          </span>
        </div>
        <div
          className={styles.track}
          role="progressbar"
          aria-label="Read-along progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
        >
          <div className={styles.trackFill} style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {favourite !== null && (
        <button
          type="button"
          className={styles.favourite}
          onClick={favourite.onToggle}
          aria-pressed={favourite.on}
          aria-label={favourite.on ? "Favourited" : "Favourite"}
          data-testid={readerPlayerBarTestIds.favouriteButton}
        >
          <FavouriteIcon filled={favourite.on} />
        </button>
      )}

      <button
        type="button"
        className={styles.rate}
        onClick={onCycleRate}
        aria-label={`Reading speed ${rateLabel}`}
        data-testid={readerPlayerBarTestIds.rateButton}
      >
        {rateLabel}
      </button>
    </div>
  );
}
