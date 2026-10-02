import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useDismissOnOutside } from "../../../../util/useDismissOnOutside.js";
import { LIBRARY_SORTS, LIBRARY_SORT_LABEL, type LibrarySort } from "../../types/LibrarySort.js";
import styles from "./SortPill.module.scss";
import { sortPillTestIds } from "./SortPillTestIds.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";

export interface SortPillProps {
  sort: LibrarySort;
  onChange: (sort: LibrarySort) => void;
}

export function SortPill({ sort, onChange }: SortPillProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const analytics = useAnalytics();

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  useDismissOnOutside(open, close, root);

  useEffect(() => {
    if (open) {
      options.current[LIBRARY_SORTS.indexOf(sort)]?.focus();
    }
  }, [open, sort]);

  const choose = (next: LibrarySort) => {
    close();
    if (next !== sort) {
      onChange(next);
    }
  };

  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = options.current.indexOf(document.activeElement as HTMLButtonElement);
    const last = LIBRARY_SORTS.length - 1;
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
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        onClick={() => {
          if (!open) analytics.library.sortPill.opened();
          setOpen(!open);
        }}
        aria-label={`Sort: ${LIBRARY_SORT_LABEL[sort]}`}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid={sortPillTestIds.trigger}
      >
        {LIBRARY_SORT_LABEL[sort]}
        <StrokeIcon name="chevronDown" />
      </button>

      {open && (
        <div
          className={styles.menu}
          role="menu"
          aria-label="Sort overviews"
          onKeyDown={moveFocus}
          data-testid={sortPillTestIds.menu}
        >
          {LIBRARY_SORTS.map((option, index) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === sort}
              tabIndex={-1}
              ref={(element) => {
                options.current[index] = element;
              }}
              className={styles.item}
              onClick={() => choose(option)}
              data-testid={sortPillTestIds.option(option)}
            >
              {LIBRARY_SORT_LABEL[option]}
              {option === sort && <StrokeIcon name="check" size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
