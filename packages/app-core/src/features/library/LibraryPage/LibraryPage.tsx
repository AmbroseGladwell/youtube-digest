import { useRef, useState } from "react";
import { useSearchParams } from "react-router";
import type { Overview, OverviewId } from "@overview/domain";
import { usePlayer, usePlayerSnapshot } from "../../player/PlayerContext.js";
import { playerTrackFor } from "../../player/types/PlayerTrack.js";
import { useCreateTopicMutation } from "../../overviews/mutations/useCreateTopicMutation.js";
import { useSetOverviewStateMutation } from "../../overviews/mutations/useSetOverviewStateMutation.js";
import { ErrorState } from "../../../components/shared/ErrorState/ErrorState.js";
import { ClearFieldButton } from "../../../components/shared/ClearFieldButton/ClearFieldButton.js";
import { StrokeIcon } from "../../../components/shared/StrokeIcon/StrokeIcon.js";
import { useTopicsQuery } from "../../overviews/queries/topicsQuery.js";
import {
  libraryEntryId,
  readableEntries,
  type LibraryEntry,
} from "../../overviews/types/LibraryEntry.js";
import { unsortedOverviews } from "../../overviews/util/topicCounts.js";
import { FilterPanel } from "../components/FilterPanel/FilterPanel.js";
import { NewTopicDialog } from "../components/NewTopicDialog/NewTopicDialog.js";
import { SortPill } from "../components/SortPill/SortPill.js";
import { LibraryOverviewCard } from "../components/LibraryOverviewCard/LibraryOverviewCard.js";
import { LibraryUnreadableCard } from "../components/LibraryUnreadableCard/LibraryUnreadableCard.js";
import { appliedLibraryFilters } from "../util/appliedLibraryFilters.js";
import { libraryFilterCounts } from "../util/libraryFilterCounts.js";
import {
  applyLibraryFilterPatch,
  applyLibrarySort,
  parseLibraryFilters,
  parseLibrarySort,
} from "../util/libraryFilterParams.js";
import { matchesLibraryFilters } from "../util/matchesLibraryFilters.js";
import { orderLibraryEntries } from "../util/orderLibraryEntries.js";
import { DEFAULT_LIBRARY_FILTERS } from "../types/LibraryFilters.js";
import { useDismissOnOutside } from "../../../util/useDismissOnOutside.js";
import { useFocusTrap } from "../../../util/useFocusTrap.js";
import { useEnteringOverviewIds } from "./useEnteringOverviewIds.js";
import styles from "./LibraryPage.module.scss";
import { libraryPageTestIds } from "./LibraryPageTestIds.js";

export interface LibraryPageProps {
  entries: LibraryEntry[];
}

export function LibraryPage({ entries }: LibraryPageProps) {
  const topicsQuery = useTopicsQuery();
  const [searchParams, setSearchParams] = useSearchParams();
  const setOverviewState = useSetOverviewStateMutation();
  const player = usePlayer();
  const playerSnapshot = usePlayerSnapshot();

  // Design 3a: Listen plays in place and docks the mini-player; the row that is playing
  // says so, and pressing it again pauses (docs/features/audio-player.md).
  const isPlaying = (overviewId: OverviewId) =>
    playerSnapshot.track?.overviewId === overviewId &&
    ["playing", "buffering", "preparing"].includes(playerSnapshot.status);
  const listen = (overview: Overview) => {
    if (playerSnapshot.track?.overviewId === overview.id) {
      player.toggle();
      return;
    }
    player.load(playerTrackFor(overview));
    player.play();
  };
  const createTopic = useCreateTopicMutation();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const rail = useRef<HTMLElement | null>(null);
  const [newTopicOpen, setNewTopicOpen] = useState(false);

  const entering = useEnteringOverviewIds(entries.map(libraryEntryId));
  // The rail is a sheet over the page only in the narrow layout, and only there does it
  // hold the keyboard. On the wide one it is part of the page and `filtersOpen` is never
  // set, the button that would set it being hidden.
  const closeFilters = () => setFiltersOpen(false);
  useFocusTrap(filtersOpen, rail);
  useDismissOnOutside(filtersOpen, closeFilters, rail);

  if (topicsQuery.isError) {
    return (
      <ErrorState
        title="Couldn't load your topics"
        error={topicsQuery.error}
        action={{ label: "Try again", onSelect: () => void topicsQuery.refetch() }}
      />
    );
  }

  const filters = parseLibraryFilters(searchParams);
  const topics = topicsQuery.data ?? [];
  const counts = libraryFilterCounts(entries);
  const applied = appliedLibraryFilters(filters, topics);
  const topicNameById = new Map(topics.map((topic) => [topic.id, topic.name]));
  const changeFilters = (patch: Parameters<typeof applyLibraryFilterPatch>[1]) =>
    setSearchParams(applyLibraryFilterPatch(searchParams, patch), { replace: true });

  const sort = parseLibrarySort(searchParams);
  const visible = orderLibraryEntries(
    entries.filter((entry) => matchesLibraryFilters(entry, filters)),
    sort,
  );

  return (
    <div className={styles.root} data-testid={libraryPageTestIds.root}>
      <div className={styles.filterBar}>
        <button
          type="button"
          className={`${styles.filterButton} ${applied.length > 0 ? styles.filterButtonActive : ""}`}
          onClick={() => setFiltersOpen(true)}
          aria-label="Filters"
          aria-expanded={filtersOpen}
          data-testid={libraryPageTestIds.filterButton}
        >
          <StrokeIcon name="filter" size={17} />
        </button>
        <div className={styles.appliedRow}>
          {applied.length === 0 ? (
            <span className={styles.noFilters}>No filters</span>
          ) : (
            applied.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className={styles.appliedChip}
                onClick={() => changeFilters(chip.clear)}
                data-testid={libraryPageTestIds.appliedChip(chip.key)}
              >
                {chip.label}
                <StrokeIcon name="close" size={12} />
              </button>
            ))
          )}
        </div>
      </div>

      <div className={styles.grid}>
        <aside
          ref={rail}
          className={`${styles.rail} ${filtersOpen ? styles.railOpen : ""}`}
          aria-label="Filters"
          data-testid={libraryPageTestIds.rail}
        >
          <div className={styles.sheetHead}>
            <span className={styles.sheetTitle}>Filters</span>
            <button
              type="button"
              className={styles.sheetDone}
              onClick={closeFilters}
              data-testid={libraryPageTestIds.closeFiltersButton}
            >
              Done
            </button>
          </div>
          <div className={styles.railBody} data-testid={libraryPageTestIds.railBody}>
            <FilterPanel
              filters={filters}
              topics={topics}
              counts={counts}
              onChange={changeFilters}
              onNewTopic={() => {
                setFiltersOpen(false);
                setNewTopicOpen(true);
              }}
            />
          </div>
          <div className={styles.sheetFoot}>
            <button
              type="button"
              className={styles.clearAll}
              onClick={() => changeFilters(DEFAULT_LIBRARY_FILTERS)}
              data-testid={libraryPageTestIds.clearFiltersButton}
            >
              Clear all
            </button>
            <span className={styles.sheetCount}>
              {visible.length} of {counts.total} shown
              {counts.unreadable > 0 && ` · ${counts.unreadable} couldn't be read`}
            </span>
          </div>
        </aside>

        <main className={styles.main}>
          <div className={styles.listHead}>
            <div>
              <h1 className={styles.title}>Overviews</h1>
              <p className={styles.listCount} data-testid={libraryPageTestIds.listCount}>
                {counts.total} {counts.total === 1 ? "overview" : "overviews"} · {counts.unread} unread
              </p>
            </div>
            <SortPill
              sort={sort}
              onChange={(next) =>
                setSearchParams(applyLibrarySort(searchParams, next), { replace: true })
              }
            />
          </div>

          <div className={styles.search}>
            <span className={styles.searchIcon} aria-hidden="true">
              <StrokeIcon name="search" size={16} />
            </span>
            <input
              type="search"
              className={styles.searchInput}
              placeholder="Search claims, channels, tags"
              value={filters.query}
              onChange={(event) => changeFilters({ query: event.target.value })}
              aria-label="Search overviews"
              data-testid={libraryPageTestIds.searchInput}
            />
            {filters.query !== "" && (
              <ClearFieldButton
                label="Clear search"
                onClick={() => changeFilters({ query: "" })}
                testId={libraryPageTestIds.clearSearchButton}
              />
            )}
          </div>

          {visible.length === 0 ? (
            <p className={styles.empty} data-testid={libraryPageTestIds.empty}>
              No overviews match these filters.
            </p>
          ) : (
            <div className={styles.list} data-testid={libraryPageTestIds.list}>
              {visible.map((entry) =>
                entry.kind === "unreadable" ? (
                  <LibraryUnreadableCard
                    key={entry.record.id}
                    record={entry.record}
                    entering={entering.has(entry.record.id)}
                  />
                ) : (
                  <LibraryOverviewCard
                    key={entry.overview.id}
                    overviewWithState={entry}
                    entering={entering.has(entry.overview.id)}
                    topicNames={entry.overview.topicIds
                      .map((topicId) => topicNameById.get(topicId))
                      .filter((name): name is string => name !== undefined)}
                    onToggleFavourite={() =>
                      setOverviewState.mutate({
                        overviewId: entry.overview.id,
                        patch: { favourite: !entry.state.favourite },
                      })
                    }
                    onToggleRead={() =>
                      setOverviewState.mutate({
                        overviewId: entry.overview.id,
                        patch: { read: !entry.state.read },
                      })
                    }
                    playing={isPlaying(entry.overview.id)}
                    onListen={() => listen(entry.overview)}
                  />
                ),
              )}
            </div>
          )}
        </main>
      </div>

      <div
        className={`${styles.scrim} ${filtersOpen ? styles.scrimOpen : ""}`}
        onClick={closeFilters}
        aria-hidden="true"
      />

      <NewTopicDialog
        open={newTopicOpen}
        unsorted={unsortedOverviews(readableEntries(entries).map((entry) => entry.overview))}
        busy={createTopic.isPending}
        onCreate={(input) => {
          createTopic.mutate(input, { onSuccess: () => setNewTopicOpen(false) });
        }}
        onClose={() => setNewTopicOpen(false)}
      />
    </div>
  );
}
