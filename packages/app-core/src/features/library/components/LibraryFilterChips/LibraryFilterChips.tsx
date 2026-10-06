import { useLayoutEffect, useRef, useState } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { fittingChipCount, type LibraryFilterChip } from "../../util/libraryFilterChips.js";
import styles from "./LibraryFilterChips.module.scss";
import { libraryFilterChipsTestIds } from "./LibraryFilterChipsTestIds.js";

export interface LibraryFilterChipsProps {
  chips: LibraryFilterChip[];
  onRemove: (chip: LibraryFilterChip) => void;
  onMore: () => void;
}

const GAP = 8;

// The filters changed from the default, on one line under the search that never wraps:
// whole chips while they fit, then "+N" for the rest ("OV-84 2 Library Filter" 84o, 84r-2).
// A hidden copy of the row is what gets measured, since a chip that is not shown has no width.
export function LibraryFilterChips({ chips, onRemove, onMore }: LibraryFilterChipsProps) {
  const row = useRef<HTMLDivElement | null>(null);
  const measure = useRef<HTMLDivElement | null>(null);
  const [fitting, setFitting] = useState(chips.length);

  useLayoutEffect(() => {
    const rowElement = row.current;
    const measureElement = measure.current;
    if (!rowElement || !measureElement) return;
    const fit = () => {
      const widths = [...measureElement.querySelectorAll<HTMLElement>("[data-chip]")].map((chip) => chip.offsetWidth);
      const more = measureElement.querySelector<HTMLElement>("[data-more]")?.offsetWidth ?? 0;
      setFitting(fittingChipCount(widths, rowElement.clientWidth, more, GAP));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(rowElement);
    return () => observer.disconnect();
  }, [chips]);

  if (chips.length === 0) {
    return null;
  }

  const shown = chips.slice(0, fitting);
  const hidden = chips.length - shown.length;

  return (
    <div
      ref={row}
      className={styles.root}
      role="group"
      aria-label="Filters set"
      data-glide-name="library-chips"
      data-testid={libraryFilterChipsTestIds.root}
    >
      {shown.map((chip) => (
        <span key={chip.key} className={styles.chip} data-testid={libraryFilterChipsTestIds.chip(chip.key)}>
          {chip.label}
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
          type="button"
          className={styles.more}
          onClick={onMore}
          aria-label={`${hidden} more ${hidden === 1 ? "filter" : "filters"} set. Open Filters`}
          data-testid={libraryFilterChipsTestIds.moreButton}
        >
          +{hidden}
        </button>
      )}
      <div ref={measure} className={styles.measure} aria-hidden="true" inert>
        {chips.map((chip) => (
          <span key={chip.key} className={styles.chip} data-chip>
            {chip.label}
            <span className={styles.remove}>
              <StrokeIcon name="close" size={14} />
            </span>
          </span>
        ))}
        <span className={styles.more} data-more>
          +{chips.length}
        </span>
      </div>
    </div>
  );
}
