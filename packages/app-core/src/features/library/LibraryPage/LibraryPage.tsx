import { useState } from "react";
import { useSearchParams } from "react-router";
import { useCreateTopicMutation } from "../../overviews/mutations/useCreateTopicMutation.js";
import { useSetOverviewStateMutation } from "../../overviews/mutations/useSetOverviewStateMutation.js";
import { ErrorState } from "../../../components/shared/ErrorState/ErrorState.js";
import { useTopicsQuery } from "../../overviews/queries/topicsQuery.js";
import type { OverviewWithState } from "../../overviews/types/OverviewWithState.js";
import { orderOverviewsBySavedAt } from "../../overviews/util/orderOverviewsBySavedAt.js";
import { unsortedOverviews } from "../../overviews/util/topicCounts.js";
import { FilterPanel } from "../components/FilterPanel/FilterPanel.js";
import { NewTopicDialog } from "../components/NewTopicDialog/NewTopicDialog.js";
import { LibraryOverviewCard } from "../components/LibraryOverviewCard/LibraryOverviewCard.js";
import { appliedLibraryFilters } from "../util/appliedLibraryFilters.js";
import { libraryFilterCounts } from "../util/libraryFilterCounts.js";
import { applyLibraryFilterPatch, parseLibraryFilters } from "../util/libraryFilterParams.js";
import { matchesLibraryFilters } from "../util/matchesLibraryFilters.js";
import { DEFAULT_LIBRARY_FILTERS } from "../types/LibraryFilters.js";
import { useEnteringOverviewIds } from "./useEnteringOverviewIds.js";
import styles from "./LibraryPage.module.scss";
import { libraryPageTestIds } from "./LibraryPageTestIds.js";

export interface LibraryPageProps {
  overviewsWithState: OverviewWithState[];
}

export function LibraryPage({ overviewsWithState }: LibraryPageProps) {
  const topicsQuery = useTopicsQuery();
  const [searchParams, setSearchParams] = useSearchParams();
  const setOverviewState = useSetOverviewStateMutation();
  const createTopic = useCreateTopicMutation();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [newTopicOpen, setNewTopicOpen] = useState(false);

  const entering = useEnteringOverviewIds(overviewsWithState.map((entry) => entry.overview.id));

  if (topicsQuery.isError) {
    return (
      <ErrorState
        title="Couldn't load your topics"
        action={{ label: "Try again", onSelect: () => void topicsQuery.refetch() }}
      />
    );
  }

  const filters = parseLibraryFilters(searchParams);
  const topics = topicsQuery.data ?? [];
  const counts = libraryFilterCounts(overviewsWithState);
  const applied = appliedLibraryFilters(filters, topics);
  const topicNameById = new Map(topics.map((topic) => [topic.id, topic.name]));
  const changeFilters = (patch: Parameters<typeof applyLibraryFilterPatch>[1]) =>
    setSearchParams(applyLibraryFilterPatch(searchParams, patch), { replace: true });

  const visible = orderOverviewsBySavedAt(
    overviewsWithState.filter((entry) => matchesLibraryFilters(entry, filters)),
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
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M4 6h16" />
            <path d="M7 12h10" />
            <path d="M10 18h4" />
          </svg>
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
                {chip.label} <span aria-hidden="true">×</span>
              </button>
            ))
          )}
        </div>
      </div>

      <div className={styles.grid}>
        <aside
          className={`${styles.rail} ${filtersOpen ? styles.railOpen : ""}`}
          data-testid={libraryPageTestIds.rail}
        >
          <div className={styles.sheetHead}>
            <span className={styles.sheetTitle}>Filters</span>
            <button
              type="button"
              className={styles.sheetDone}
              onClick={() => setFiltersOpen(false)}
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
            </span>
          </div>
        </aside>

        <main className={styles.main}>
          <div className={styles.listHead}>
            <p className={styles.listCount} data-testid={libraryPageTestIds.listCount}>
              {counts.total} {counts.total === 1 ? "overview" : "overviews"} · {counts.unread} unread
            </p>
            <p className={styles.listOrder}>Newest saved first</p>
          </div>

          {visible.length === 0 ? (
            <p className={styles.empty} data-testid={libraryPageTestIds.empty}>
              No overviews match these filters.
            </p>
          ) : (
            <div className={styles.list} data-testid={libraryPageTestIds.list}>
              {visible.map((entry) => (
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
                />
              ))}
            </div>
          )}
        </main>
      </div>

      <div
        className={`${styles.scrim} ${filtersOpen ? styles.scrimOpen : ""}`}
        onClick={() => setFiltersOpen(false)}
        aria-hidden="true"
      />

      <NewTopicDialog
        open={newTopicOpen}
        unsorted={unsortedOverviews(overviewsWithState.map((entry) => entry.overview))}
        busy={createTopic.isPending}
        onCreate={(input) => {
          createTopic.mutate(input, { onSuccess: () => setNewTopicOpen(false) });
        }}
        onClose={() => setNewTopicOpen(false)}
      />
    </div>
  );
}
