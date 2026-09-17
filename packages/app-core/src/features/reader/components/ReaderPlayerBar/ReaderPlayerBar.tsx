import { FavouriteIcon } from "../../../../components/shared/FavouriteIcon/FavouriteIcon.js";
import styles from "./ReaderPlayerBar.module.scss";
import { readerPlayerBarTestIds } from "./ReaderPlayerBarTestIds.js";

export interface ReaderPlayerBarProps {
  playing: boolean;
  elapsed: string;
  total: string;
  progressPercent: number;
  rateLabel: string;
  currentSection: string;
  favourite: boolean;
  onTogglePlaying: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onCycleRate: () => void;
  onToggleFavourite: () => void;
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
  onToggleFavourite,
}: ReaderPlayerBarProps) {
  return (
    <div className={styles.root} data-testid={readerPlayerBarTestIds.root}>
      <div className={styles.progress}>
        <span className={styles.clock} data-testid={readerPlayerBarTestIds.elapsed}>
          {elapsed}
        </span>
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
        <span className={styles.clock} data-testid={readerPlayerBarTestIds.total}>
          {total}
        </span>
      </div>

      <button
        type="button"
        className={styles.rate}
        onClick={onCycleRate}
        aria-label={`Reading speed ${rateLabel}`}
        data-testid={readerPlayerBarTestIds.rateButton}
      >
        {rateLabel}
      </button>

      <div className={styles.transport}>
        <button
          type="button"
          className={styles.step}
          onClick={onPrevious}
          aria-label="Previous line"
          data-testid={readerPlayerBarTestIds.previousButton}
        >
          ◀◀
        </button>
        <button
          type="button"
          className={styles.play}
          onClick={onTogglePlaying}
          aria-pressed={playing}
          aria-label={playing ? "Pause" : "Play"}
          data-testid={readerPlayerBarTestIds.playButton}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <button
          type="button"
          className={styles.step}
          onClick={onNext}
          aria-label="Next line"
          data-testid={readerPlayerBarTestIds.nextButton}
        >
          ▶▶
        </button>
      </div>

      <button
        type="button"
        className={styles.favourite}
        onClick={onToggleFavourite}
        aria-pressed={favourite}
        aria-label={favourite ? "Favourited" : "Favourite"}
        data-testid={readerPlayerBarTestIds.favouriteButton}
      >
        <FavouriteIcon filled={favourite} />
      </button>

      <p className={styles.nowReading} data-testid={readerPlayerBarTestIds.nowReading}>
        Now reading · {currentSection}
      </p>
    </div>
  );
}
