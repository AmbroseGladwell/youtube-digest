import { forwardRef, useLayoutEffect, useRef, useState } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { fittingChipCount } from "../../../../util/fittingChipCount.js";
import type { LibraryFilterChip } from "../../util/libraryFilterChips.js";
import styles from "./LibraryFilterChips.module.scss";
import { libraryFilterChipsTestIds } from "./LibraryFilterChipsTestIds.js";

export interface LibraryFilterChipsProps {
  chips: LibraryFilterChip[];
  onRemove: (chip: LibraryFilterChip) => void;
  onMore: () => void;
  onReset: () => void;
  moreOpen: boolean;
}

const GAP = 8;

// One line at every width: only whole chips that fit beside +N and Reset, measured from a hidden copy (design 399o-17, 399o-23).
export const LibraryFilterChips = forwardRef<HTMLButtonElement, LibraryFilterChipsProps>(
  ({ chips, onRemove, onMore, onReset, moreOpen }, moreRef) => {
    const row = useRef<HTMLDivElement | null>(null);
    const measure = useRef<HTMLDivElement | null>(null);
    const [fitting, setFitting] = useState(chips.length);

    useLayoutEffect(() => {
      const rowElement = row.current;
      const measureElement = measure.current;
      if (!rowElement || !measureElement) {
        return;
      }
      const fit = () => {
        const half = rowElement.clientWidth / 2;
        const widths = [...measureElement.querySelectorAll<HTMLElement>("[data-chip]")].map((chip) => Math.min(chip.offsetWidth, half));
        const more = measureElement.querySelector<HTMLElement>("[data-more]")?.offsetWidth ?? 0;
        const reset = measureElement.querySelector<HTMLElement>("[data-reset]")?.offsetWidth ?? 0;
        setFitting(fittingChipCount(widths, rowElement.clientWidth - reset - GAP, more, GAP));
      };
      fit();
      const observer = new ResizeObserver(fit);
      observer.observe(rowElement);
      void document.fonts?.ready.then(fit);
      return () => observer.disconnect();
    }, [chips]);

    if (chips.length === 0) {
      return null;
    }

    const shown = chips.slice(0, fitting);
    const hidden = chips.length - shown.length;
    const chipBody = (chip: LibraryFilterChip) => (
      <span className={styles.label} title={chip.label}>
        {chip.label}
      </span>
    );

    return (
      <div
        ref={row}
        className={styles.root}
        role="group"
        aria-label={`Applied filters, ${chips.length}`}
        data-glide-name="library-chips"
        data-testid={libraryFilterChipsTestIds.root}
      >
        {shown.map((chip) => (
          <span key={chip.key} className={styles.chip} data-testid={libraryFilterChipsTestIds.chip(chip.key)}>
            {chipBody(chip)}
            <button
              type="button"
              className={styles.remove}
              onClick={() => onRemove(chip)}
              aria-label={chip.removeLabel}
              data-testid={libraryFilterChipsTestIds.removeButton(chip.key)}
            >
              <StrokeIcon name="close" size={14} />
            </button>
          </span>
        ))}
        {hidden > 0 && (
          <button
            ref={moreRef}
            type="button"
            className={styles.more}
            onClick={onMore}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-label={`${hidden} more ${hidden === 1 ? "filter" : "filters"}, see all applied`}
            data-testid={libraryFilterChipsTestIds.moreButton}
          >
            +{hidden}
          </button>
        )}
        <button type="button" className={styles.reset} onClick={onReset} data-testid={libraryFilterChipsTestIds.resetButton}>
          Reset
        </button>
        <div ref={measure} className={styles.measure} aria-hidden="true" inert>
          {chips.map((chip) => (
            <span key={chip.key} className={styles.chip} data-chip>
              {chipBody(chip)}
              <span className={styles.remove}>
                <StrokeIcon name="close" size={14} />
              </span>
            </span>
          ))}
          <span className={styles.more} data-more>
            +{chips.length}
          </span>
          <span className={styles.reset} data-reset>
            Reset
          </span>
        </div>
      </div>
    );
  },
);
LibraryFilterChips.displayName = "LibraryFilterChips";
