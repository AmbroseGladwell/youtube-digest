import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import type { Overview, OverviewId } from "@overview/types";
import { GenerateOverviewForm } from "../../newOverview/components/GenerateOverviewForm/GenerateOverviewForm.js";
import { useSetOverviewStateMutation } from "../../overviews/mutations/useSetOverviewStateMutation.js";
import { useTopicsQuery } from "../../overviews/queries/topicsQuery.js";
import type { OverviewWithState } from "../../overviews/types/OverviewWithState.js";
import { FilterPanel } from "../components/FilterPanel/FilterPanel.js";
import { LibraryOverviewCard } from "../components/LibraryOverviewCard/LibraryOverviewCard.js";
import { applyLibraryFilterPatch, parseLibraryFilters } from "../util/libraryFilterParams.js";
import { matchesLibraryFilters } from "../util/matchesLibraryFilters.js";
import styles from "./LibraryPage.module.scss";
import { libraryPageTestIds } from "./LibraryPageTestIds.js";

export interface LibraryPageProps {
  overviewsWithState: OverviewWithState[];
  justGeneratedId: OverviewId | null;
  onGenerated: (overview: Overview) => void;
}

export function LibraryPage({ overviewsWithState, justGeneratedId, onGenerated }: LibraryPageProps) {
  const topicsQuery = useTopicsQuery();
  const [searchParams, setSearchParams] = useSearchParams();
  const setOverviewState = useSetOverviewStateMutation();
  const [expandedId, setExpandedId] = useState<OverviewId | null>(justGeneratedId);

  useEffect(() => {
    if (justGeneratedId) setExpandedId(justGeneratedId);
  }, [justGeneratedId]);

  const filters = parseLibraryFilters(searchParams);
  const topics = topicsQuery.data ?? [];
  const visible = overviewsWithState
    .filter((entry) => matchesLibraryFilters(entry, filters))
    .sort((a, b) => b.overview.savedAt.localeCompare(a.overview.savedAt));

  return (
    <div className={styles.root} data-testid={libraryPageTestIds.root}>
      <GenerateOverviewForm variant="compact" onGenerated={onGenerated} />

      <FilterPanel
        filters={filters}
        topics={topics}
        onChange={(patch) => setSearchParams(applyLibraryFilterPatch(searchParams, patch), { replace: true })}
      />

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
    </div>
  );
}
