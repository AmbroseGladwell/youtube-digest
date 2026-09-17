import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import type { OverviewId } from "@overview/types";
import { useSetOverviewStateMutation } from "../../overviews/mutations/useSetOverviewStateMutation.js";
import { useTopicsQuery } from "../../overviews/queries/topicsQuery.js";
import type { OverviewWithState } from "../../overviews/types/OverviewWithState.js";
import { FilterPanel } from "../components/FilterPanel/FilterPanel.js";
import { LibraryOverviewCard } from "../components/LibraryOverviewCard/LibraryOverviewCard.js";
import { appliedLibraryFilters } from "../util/appliedLibraryFilters.js";
import { libraryFilterCounts } from "../util/libraryFilterCounts.js";
import { applyLibraryFilterPatch, parseLibraryFilters } from "../util/libraryFilterParams.js";
import { matchesLibraryFilters } from "../util/matchesLibraryFilters.js";
import { DEFAULT_LIBRARY_FILTERS } from "../types/LibraryFilters.js";
import styles from "./LibraryPage.module.scss";
import { libraryPageTestIds } from "./LibraryPageTestIds.js";

export interface LibraryPageProps {
  overviewsWithState: OverviewWithState[];
  justGeneratedId: OverviewId | null;
}

export function LibraryPage({ overviewsWithState, justGeneratedId }: LibraryPageProps) {
  const topicsQuery = useTopicsQuery();
  const [searchParams, setSearchParams] = useSearchParams();
  const setOverviewState = useSetOverviewStateMutation();
  const [expandedId, setExpandedId] = useState<OverviewId | null>(justGeneratedId);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (justGeneratedId) setExpandedId(justGeneratedId);
  }, [justGeneratedId]);

  const filters = parseLibraryFilters(searchParams);
  const topics = topicsQuery.data ?? [];
  const counts = libraryFilterCounts(overviewsWithState);
  const applied = appliedLibraryFilters(filters, topics);
  const topicNameById = new Map(topics.map((topic) => [topic.id, topic.name]));
  const changeFilters = (patch: Parameters<typeof applyLibraryFilterPatch>[1]) =>
    setSearchParams(applyLibraryFilterPatch(searchParams, patch), { replace: true });

  const visible = overviewsWithState
    .filter((entry) => matchesLibraryFilters(entry, filters))
    .sort((a, b) => b.overview.savedAt.localeCompare(a.overview.savedAt));

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
          <div className={styles.railBody}>
            <FilterPanel filters={filters} topics={topics} counts={counts} onChange={changeFilters} />
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
            <p className={styles.listCount}>
              {counts.total} {counts.total === 1 ? "note" : "notes"} · {counts.unread} unread
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
                  topicNames={entry.overview.topicIds
                    .map((topicId) => topicNameById.get(topicId))
                    .filter((name): name is string => name !== undefined)}
                  expanded={expandedId === entry.overview.id}
                  onToggleExpanded={() =>
                    setExpandedId((current) => (current === entry.overview.id ? null : entry.overview.id))
                  }
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
    </div>
  );
}
