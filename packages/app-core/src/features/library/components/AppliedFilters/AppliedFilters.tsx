import { useState, type RefObject } from "react";
import { BottomSheet } from "../../../../components/shared/BottomSheet/BottomSheet.js";
import { Popover } from "../../../../components/shared/Popover/Popover.js";
import { StrokeIcon } from "../../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useMediaQuery } from "../../../../util/useMediaQuery.js";
import { LIBRARY_CHIP_GROUPS, type LibraryChipGroup, type LibraryFilterChip } from "../../util/libraryFilterChips.js";
import { SHEET_QUERY } from "../FilterMenu/FilterMenu.js";
import styles from "./AppliedFilters.module.scss";
import { appliedFiltersTestIds } from "./AppliedFiltersTestIds.js";

export interface AppliedFiltersProps {
  open: boolean;
  anchor: RefObject<HTMLElement | null>;
  chips: readonly LibraryFilterChip[];
  shown: number;
  onRemove: (chip: LibraryFilterChip) => void;
  onClearGroup: (group: LibraryChipGroup) => void;
  onEdit: () => void;
  onReset: () => void;
  onClose: () => void;
}

const MOST_BEFORE_MORE = 6;
const SHOWN_BEFORE_MORE = 5;

const overviews = (count: number) => `${count} ${count === 1 ? "overview" : "overviews"}`;

// Every applied value, grouped as in the menu, each with its own ×: design 399o-18, 399o-25.
export const AppliedFilters = ({ open, anchor, chips, shown, onRemove, onClearGroup, onEdit, onReset, onClose }: AppliedFiltersProps) => {
  const asSheet = useMediaQuery(SHEET_QUERY);
  const [opened, setOpened] = useState<LibraryChipGroup[]>([]);
  const groups = LIBRARY_CHIP_GROUPS.map((group) => ({ group, chips: chips.filter((chip) => chip.group === group) })).filter(
    ({ chips: inGroup }) => inGroup.length > 0,
  );

  const body = (
    <div className={styles.groups}>
      {groups.map(({ group, chips: inGroup }) => {
        const folded = inGroup.length > MOST_BEFORE_MORE && !opened.includes(group);
        const listed = folded ? inGroup.slice(0, SHOWN_BEFORE_MORE) : inGroup;
        return (
          <div key={group} className={styles.group} data-testid={appliedFiltersTestIds.group(group)}>
            <div className={styles.label}>
              <span>{group}</span>
              {inGroup.length > 1 && (
                <button
                  type="button"
                  className={styles.clear}
                  onClick={() => onClearGroup(group)}
                  aria-label={`Clear ${group}`}
                  data-testid={appliedFiltersTestIds.clear(group)}
                >
                  Clear
                </button>
              )}
            </div>
            <ul className={styles.chips} aria-label={group}>
              {listed.map((chip) => (
                <li key={chip.key} className={styles.chip}>
                  <span className={styles.chipText} title={chip.label}>
                    {chip.label}
                  </span>
                  <button
                    type="button"
                    className={styles.remove}
                    onClick={() => onRemove(chip)}
                    aria-label={chip.removeLabel}
                    data-testid={appliedFiltersTestIds.remove(chip.key)}
                  >
                    <StrokeIcon name="close" size={13} />
                  </button>
                </li>
              ))}
              {folded && (
                <li>
                  <button
                    type="button"
                    className={styles.more}
                    onClick={() => setOpened([...opened, group])}
                    data-testid={appliedFiltersTestIds.more(group)}
                  >
                    +{inGroup.length - SHOWN_BEFORE_MORE} more
                  </button>
                </li>
              )}
            </ul>
          </div>
        );
      })}
      <button type="button" className={styles.edit} onClick={onEdit} data-testid={appliedFiltersTestIds.edit}>
        <StrokeIcon name="filter" size={15} />
        Edit filters
        <StrokeIcon name="arrowRight" size={14} />
      </button>
    </div>
  );
  const reset = (
    <button type="button" className={styles.reset} onClick={onReset} data-testid={appliedFiltersTestIds.reset}>
      Reset
    </button>
  );

  if (asSheet) {
    return (
      <BottomSheet
        open={open}
        title="Applied filters"
        closeLabel="Close applied filters"
        onClose={onClose}
        testId={appliedFiltersTestIds.root}
        foot={
          <>
            {reset}
            <button type="button" className={styles.showResults} onClick={onClose} data-testid={appliedFiltersTestIds.showResults}>
              Show {overviews(shown)}
            </button>
          </>
        }
      >
        {body}
      </BottomSheet>
    );
  }
  if (!open) {
    return null;
  }
  return (
    <Popover
      anchor={anchor}
      title="Applied filters"
      onClose={onClose}
      width={420}
      testId={appliedFiltersTestIds.root}
      foot={
        <>
          {reset}
          <span role="status">{overviews(shown)}</span>
        </>
      }
    >
      {body}
    </Popover>
  );
};
