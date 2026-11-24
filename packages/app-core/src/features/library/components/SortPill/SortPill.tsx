import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useDismissOnOutside } from "../../../../util/useDismissOnOutside.js";
import {
  LIBRARY_SORT_PRESET,
  LIBRARY_SORT_PRESET_LABEL,
  LIBRARY_SORT_PRESET_SHORT_LABEL,
  LIBRARY_SORT_PRESETS,
  isDefaultLibrarySort,
  librarySortLabel,
  librarySortPresetOf,
  type LibrarySort,
  type LibrarySortPreset,
} from "../../types/LibrarySort.js";
import styles from "./SortPill.module.scss";
import { sortPillTestIds } from "./SortPillTestIds.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";

export interface SortPillProps {
  sort: LibrarySort;
  onChange: (sort: LibrarySort) => void;
  compact?: boolean;
}

export const SortPill = ({ sort, onChange, compact = false }: SortPillProps) => {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const analytics = useAnalytics();
  const preset = librarySortPresetOf(sort);
  const label = preset === null ? librarySortLabel(sort) : LIBRARY_SORT_PRESET_LABEL[preset];

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  useDismissOnOutside(open, close, root);

  useEffect(() => {
    if (open) {
      options.current[preset === null ? 0 : LIBRARY_SORT_PRESETS.indexOf(preset)]?.focus();
    }
  }, [open, preset]);

  const choose = (next: LibrarySortPreset) => {
    close();
    if (next !== preset) {
      onChange(LIBRARY_SORT_PRESET[next]);
    }
  };

  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = options.current.indexOf(document.activeElement as HTMLButtonElement);
    const last = LIBRARY_SORT_PRESETS.length - 1;
    const target = {
      ArrowDown: current === last ? 0 : current + 1,
      ArrowUp: current <= 0 ? last : current - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (target !== undefined) {
      event.preventDefault();
      options.current[target]?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div className={styles.root} ref={root}>
      <button
        type="button"
        ref={trigger}
        className={
          compact
            ? `${styles.iconTrigger} ${isDefaultLibrarySort(sort) ? "" : styles.iconTriggerWide}`
            : `${styles.trigger} ${open ? styles.triggerOpen : ""}`
        }
        onClick={() => {
          if (!open) {
            analytics.library.sortPill.opened();
          }
          setOpen(!open);
        }}
        aria-label={`Sort: ${label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid={sortPillTestIds.trigger}
      >
        {compact ? (
          <>
            <StrokeIcon name="sort" size={18} />
            <span className={styles.shortLabel}>{preset === null ? label : LIBRARY_SORT_PRESET_SHORT_LABEL[preset]}</span>
          </>
        ) : (
          <>
            {label}
            <StrokeIcon name="chevronDown" />
          </>
        )}
      </button>

      {open && (
        <div className={styles.menu} role="menu" aria-label="Sort overviews" onKeyDown={moveFocus} data-testid={sortPillTestIds.menu}>
          {LIBRARY_SORT_PRESETS.map((option, index) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === preset}
              tabIndex={-1}
              ref={(element) => {
                options.current[index] = element;
              }}
              className={styles.item}
              onClick={() => choose(option)}
              data-testid={sortPillTestIds.option(option)}
            >
              {LIBRARY_SORT_PRESET_LABEL[option]}
              {option === preset && <StrokeIcon name="check" size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
