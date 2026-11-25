import { useState, type ReactNode, type RefObject } from "react";
import type { Topic } from "@overview/domain";
import { BottomSheet } from "../../../../components/shared/BottomSheet/BottomSheet.js";
import { ChoiceGroup } from "../../../../components/shared/ChoiceGroup/ChoiceGroup.js";
import { Popover } from "../../../../components/shared/Popover/Popover.js";
import { useMediaQuery } from "../../../../util/useMediaQuery.js";
import type { LibraryFilters, LibrarySourceId } from "../../types/LibraryFilters.js";
import type { LibraryFilterCounts } from "../../util/libraryFilterCounts.js";
import { FilterGroups, ListSearch, matchingSources, matchingTags, sourceChoices, tagChoices, type LongList } from "./FilterGroups.js";
import styles from "./FilterMenu.module.scss";
import { filterMenuTestIds } from "./FilterMenuTestIds.js";

// Under 48rem, 200% zoom on a laptop included, the menu is a bottom sheet: design 399o-4c.
export const SHEET_QUERY = "(max-width: 47.9375rem)";

export interface FilterMenuProps {
  anchor: RefObject<HTMLElement | null>;
  filters: LibraryFilters;
  topics: Topic[];
  counts: LibraryFilterCounts;
  open: boolean;
  shown: number;
  onChange: (patch: Partial<LibraryFilters>) => void;
  onReset: () => void;
  onClose: () => void;
  onNewTopic: () => void;
  onManageTags: () => void;
  extra?: ReactNode;
}

const overviews = (count: number) => `${count} ${count === 1 ? "overview" : "overviews"}`;

const toggled = <T,>(values: readonly T[], value: T, on: boolean): T[] =>
  on ? [...values.filter((each) => each !== value), value] : values.filter((each) => each !== value);

// Each tap applies at once; the URL stays the source of truth, so there is no Apply (design 399o).
export const FilterMenu = ({
  open,
  anchor,
  filters,
  topics,
  counts,
  shown,
  onChange,
  onReset,
  onClose,
  onNewTopic,
  onManageTags,
  extra,
}: FilterMenuProps) => {
  const asSheet = useMediaQuery(SHEET_QUERY);
  const [longList, setLongList] = useState<LongList | null>(null);
  const [query, setQuery] = useState("");
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setLongList(null);
    }
  }

  const groups = (
    <FilterGroups
      filters={filters}
      topics={topics}
      counts={counts}
      onChange={onChange}
      onNewTopic={onNewTopic}
      onManageTags={onManageTags}
      topShown={asSheet ? 4 : 5}
      onShowAll={
        asSheet
          ? (list) => {
              setQuery("");
              setLongList(list);
            }
          : null
      }
    />
  );
  const reset = (
    <button type="button" className={styles.reset} onClick={onReset} data-testid={filterMenuTestIds.reset}>
      Reset
    </button>
  );

  if (!asSheet) {
    return !open ? null : (
      <Popover
        anchor={anchor}
        title="Filters"
        onClose={onClose}
        testId={filterMenuTestIds.root}
        foot={
          <>
            {reset}
            <span role="status" data-testid={filterMenuTestIds.count}>
              {overviews(shown)}
            </span>
          </>
        }
      >
        {groups}
        {extra}
      </Popover>
    );
  }

  if (longList !== null) {
    const matches = longList === "source" ? matchingSources(counts, query) : matchingTags(counts, query);
    const total = longList === "source" ? counts.bySource.length : counts.byTag.length;
    const noun = longList === "source" ? "sources" : "tags";
    return (
      <BottomSheet
        open={open}
        title={longList === "source" ? "Sources" : "Tags"}
        closeLabel="Close filters"
        onClose={onClose}
        onBack={() => setLongList(null)}
        testId={filterMenuTestIds.root}
        foot={
          <button type="button" className={styles.done} onClick={() => setLongList(null)} data-testid={filterMenuTestIds.done}>
            Done
          </button>
        }
      >
        <ListSearch group={longList} label={`Search ${total} ${noun}`} value={query} onChange={setQuery} />
        <p className={styles.matches} role="status" data-testid={filterMenuTestIds.matches}>
          {query.trim() === "" ? `${total} ${noun}, most used first` : `${matches.length} ${noun} match`}
        </p>
        {longList === "source" ? (
          <ChoiceGroup
            legend="Source"
            name="filter-source-all"
            look="rows"
            multiple
            choices={sourceChoices(counts, matches as LibrarySourceId[])}
            chosen={filters.sources}
            onChoose={(value, on) => onChange({ sources: toggled(filters.sources, value as LibrarySourceId, on) })}
          />
        ) : (
          <ChoiceGroup
            legend="Tags"
            name="filter-tags-all"
            look="rows"
            multiple
            choices={tagChoices(counts, matches)}
            chosen={filters.tags}
            onChoose={(value, on) => onChange({ tags: toggled(filters.tags, value, on) })}
          />
        )}
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      open={open}
      title="Filters"
      closeLabel="Close filters"
      onClose={onClose}
      testId={filterMenuTestIds.root}
      foot={
        <>
          {reset}
          <button type="button" className={styles.showResults} onClick={onClose} data-testid={filterMenuTestIds.showResults}>
            Show {overviews(shown)}
          </button>
        </>
      }
    >
      {groups}
      {extra}
    </BottomSheet>
  );
};
