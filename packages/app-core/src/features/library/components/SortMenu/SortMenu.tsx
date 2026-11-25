import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { BottomSheet } from "../../../../components/shared/BottomSheet/BottomSheet.js";
import { Popover } from "../../../../components/shared/Popover/Popover.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useMediaQuery } from "../../../../util/useMediaQuery.js";
import {
  DEFAULT_LIBRARY_SORT,
  LIBRARY_SORT_FIELDS,
  defaultDirectionOf,
  groupsFor,
  isDateSortField,
  isDefaultLibrarySort,
  libraryDirectionLabel,
  librarySortLabel,
  LIBRARY_SORT_FIELD_LABEL,
  type LibraryGroup,
  type LibrarySort,
  type LibrarySortDirection,
  type LibrarySortField,
} from "../../types/LibrarySort.js";
import { SHEET_QUERY } from "../FilterMenu/FilterMenu.js";
import styles from "./SortMenu.module.scss";
import { sortMenuTestIds } from "./SortMenuTestIds.js";
import { useAnalytics } from "../../../analytics/AnalyticsContext.js";

export interface SortMenuProps {
  sort: LibrarySort;
  onChange: (sort: LibrarySort) => void;
}

const FIELD_LINE: Record<LibrarySortField, string> = {
  added: "When you saved it",
  published: "When it came out",
  updated: "Saved, edited or asked about",
  title: "By name",
};

const GROUP_LABEL: Record<LibraryGroup, string> = { none: "None", day: "Day", week: "Week", month: "Month", letter: "Letter" };

// A date field keeps its direction and grouping where they still fit; Title starts A–Z.
const withField = (sort: LibrarySort, field: LibrarySortField): LibrarySort => {
  const sameKind = isDateSortField(field) === isDateSortField(sort.field);
  return {
    field,
    direction: sameKind ? sort.direction : defaultDirectionOf(field),
    group: groupsFor(field).includes(sort.group) ? sort.group : "none",
  };
};

// Sort by, Order and Group by in one menu: menuitemradio in named groups (design 399p).
export const SortMenu = ({ sort, onChange }: SortMenuProps) => {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const asSheet = useMediaQuery(SHEET_QUERY);
  const analytics = useAnalytics();
  const label = librarySortLabel(sort);

  const choose = (next: LibrarySort) => {
    if (next.field !== sort.field || next.direction !== sort.direction || next.group !== sort.group) {
      onChange(next);
    }
  };
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>("[role='menuitemradio']")];
    const current = items.indexOf(document.activeElement as HTMLElement);
    const last = items.length - 1;
    const target = { ArrowDown: current >= last ? 0 : current + 1, ArrowUp: current <= 0 ? last : current - 1, Home: 0, End: last }[
      event.key
    ];
    if (target !== undefined) {
      event.preventDefault();
      items[target]?.focus();
    }
  };

  const item = (
    group: "field" | "order" | "group",
    value: string,
    checked: boolean,
    onSelect: () => void,
    body: ReactNode,
    chip: boolean,
  ) => (
    <button
      key={value}
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      tabIndex={-1}
      className={chip ? `${styles.chip} ${checked ? styles.chipOn : ""}` : styles.row}
      onClick={onSelect}
      data-testid={sortMenuTestIds.option(group, value)}
    >
      {body}
    </button>
  );

  const directions: LibrarySortDirection[] = isDateSortField(sort.field) ? ["desc", "asc"] : ["asc", "desc"];
  const body = (
    <div className={styles.menu} onKeyDown={moveFocus} data-testid={sortMenuTestIds.menu}>
      <div role="group" aria-label="Sort by">
        <p className={styles.heading} aria-hidden="true">
          Sort by
        </p>
        {LIBRARY_SORT_FIELDS.map((field) =>
          item(
            "field",
            field,
            field === sort.field,
            () => choose(withField(sort, field)),
            <>
              <span className={`${styles.radio} ${field === sort.field ? styles.radioOn : ""}`} aria-hidden="true" />
              <span className={styles.rowText}>
                <b>{LIBRARY_SORT_FIELD_LABEL[field]}</b>
                <small>{FIELD_LINE[field]}</small>
              </span>
            </>,
            false,
          ),
        )}
      </div>
      <hr className={styles.rule} />
      <p className={styles.heading} aria-hidden="true">
        Order
      </p>
      <div role="group" aria-label="Order" className={styles.chips}>
        {directions.map((direction) =>
          item(
            "order",
            direction,
            direction === sort.direction,
            () => choose({ ...sort, direction }),
            libraryDirectionLabel({ field: sort.field, direction }).replace(/^./, (first) => first.toUpperCase()),
            true,
          ),
        )}
      </div>
      <hr className={styles.rule} />
      <p className={styles.heading} aria-hidden="true">
        Group by
      </p>
      <div role="group" aria-label="Group by" className={styles.chips}>
        {groupsFor(sort.field).map((group) =>
          item("group", group, group === sort.group, () => choose({ ...sort, group }), GROUP_LABEL[group], true),
        )}
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        onClick={() => {
          if (open) {
            close();
          } else {
            analytics.library.sortPill.opened();
            setOpen(true);
          }
        }}
        aria-label={`Sort: ${label}`}
        title={`Sort · ${label}`}
        aria-haspopup={asSheet ? "dialog" : "menu"}
        aria-expanded={open}
        data-testid={sortMenuTestIds.trigger}
      >
        <StrokeIcon name="sort" size={17} />
        {!isDefaultLibrarySort(sort) && <i className={styles.dot} aria-hidden="true" data-testid={sortMenuTestIds.dot} />}
      </button>
      {asSheet ? (
        <BottomSheet
          open={open}
          title="Sort"
          closeLabel="Close sort"
          onClose={close}
          foot={
            <>
              <button
                type="button"
                className={styles.reset}
                onClick={() => choose(DEFAULT_LIBRARY_SORT)}
                data-testid={sortMenuTestIds.reset}
              >
                Reset
              </button>
              <button type="button" className={styles.done} onClick={close} data-testid={sortMenuTestIds.done}>
                Done
              </button>
            </>
          }
        >
          <div role="menu" aria-label="Sort">
            {body}
          </div>
        </BottomSheet>
      ) : (
        open && (
          <Popover anchor={trigger} title="Sort" role="menu" titleShown={false} width={276} onClose={() => setOpen(false)}>
            {body}
          </Popover>
        )
      )}
    </>
  );
};
