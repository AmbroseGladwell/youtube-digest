import { useRef, useState } from "react";
import { spokenTimeSaved, timeSavedSummary, type Overview, type OverviewId } from "@overview/domain";
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
  applyLibraryView,
  isSameLibraryView,
} from "../util/libraryFilterParams.js";
import { matchesLibraryFilters } from "../util/matchesLibraryFilters.js";
import { orderLibraryEntries } from "../util/orderLibraryEntries.js";
import { NO_LIBRARY_FILTERS } from "../types/LibraryFilters.js";
import { DEFAULT_LIBRARY_VIEW } from "../types/LibraryView.js";
import { libraryViewState } from "../util/libraryViewState.js";
import { libraryViewSummary } from "../util/libraryViewSummary.js";
import { useLibraryView } from "./useLibraryView.js";
import { useDismissOnOutside } from "../../../util/useDismissOnOutside.js";
import { useFocusTrap } from "../../../util/useFocusTrap.js";
import { useMediaQuery } from "../../../util/useMediaQuery.js";
import { useAnalytics } from "../../analytics/AnalyticsContext.js";
import { useTypingSettled } from "../../analytics/useTypingSettled.js";
import { recordLibraryFilterChange, type FilterControl } from "../util/recordLibraryFilterChange.js";
import { MilestoneStack } from "../../timeSaved/components/MilestoneStack/MilestoneStack.js";
import { TimeSavedFigure } from "../../timeSaved/components/TimeSavedFigure/TimeSavedFigure.js";
import { TimeSavedSheet } from "../../timeSaved/components/TimeSavedSheet/TimeSavedSheet.js";
import { useMilestones } from "../../timeSaved/useMilestones.js";
import { useEnteringOverviewIds } from "./useEnteringOverviewIds.js";
import { useSurface } from "../../../app/SurfaceContext.js";
import { useIsPhone } from "../../../util/useIsPhone.js";
import { useSignedOutHere } from "../../accountLibraries/useSignedOutHere.js";
import { savedHere } from "../../accountLibraries/util/libraryPlace.js";
import { libraryCountLine } from "../util/libraryCountLine.js";
import styles from "./LibraryPage.module.scss";
import { libraryPageTestIds } from "./LibraryPageTestIds.js";
import { LibraryQueueGroup } from "../../captureQueue/components/LibraryQueueGroup/LibraryQueueGroup.js";

// Below this width the rail is a sheet behind the filter button, so a milestone sits at
// the top of the list instead (LibraryPage.module.scss; "OV-34 3 Phone and Panel" 34ad).
const RAIL_SHEET_QUERY = "(max-width: 61.9375rem)";

export interface LibraryPageProps {
  entries: LibraryEntry[];
}

export function LibraryPage({ entries }: LibraryPageProps) {
  const topicsQuery = useTopicsQuery();
  const { searchParams, view, change } = useLibraryView(topicsQuery.data);
  const [keptIds, setKeptIds] = useState<ReadonlySet<string>>(new Set());
  const changeView = (next: URLSearchParams) => {
    setKeptIds(new Set());
    change(next);
  };
  const setOverviewState = useSetOverviewStateMutation();
  const player = usePlayer();
  const playerSnapshot = usePlayerSnapshot();

  // Design 3a: Listen plays in place and docks the mini-player; the row that is playing
  // says so, and pressing it again pauses (docs/features/audio-player.md).
  const isPlaying = (overviewId: OverviewId) =>
    playerSnapshot.track?.overviewId === overviewId &&
    ["playing", "buffering", "preparing"].includes(playerSnapshot.status);
  const listen = (overview: Overview) => {
    analytics.library.overviewCard.listenPressed({ overviewId: overview.id, listening: !isPlaying(overview.id) });
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
  const [timeSavedOpen, setTimeSavedOpen] = useState(false);
  const analytics = useAnalytics();
  const searchSettled = useRef(() => {});
  useTypingSettled(view.filters.query, () => searchSettled.current());
  const railIsSheet = useMediaQuery(RAIL_SHEET_QUERY);
  const timeSaved = timeSavedSummary(readableEntries(entries));
  const milestones = useMilestones(timeSaved.minutes, true);
  const milestoneStack = (
    <MilestoneStack
      milestones={milestones.visible}
      minutes={timeSaved.minutes}
      onLineChosen={milestones.lineChosen}
      onDismiss={milestones.dismiss}
      onUndo={milestones.undo}
    />
  );

  const entering = useEnteringOverviewIds(entries.map(libraryEntryId));
  // The rail is a sheet over the page only in the narrow layout, and only there does it
  // hold the keyboard. On the wide one it is part of the page and `filtersOpen` is never
  // set, the button that would set it being hidden.
  const closeFilters = () => {
    if (filtersOpen) analytics.library.filterSheet.closed();
    setFiltersOpen(false);
  };
  useFocusTrap(filtersOpen, rail);
  useDismissOnOutside(filtersOpen, closeFilters, rail);
  const surface = useSurface();
  const phone = useIsPhone();
  const signedOutHere = useSignedOutHere();

  if (topicsQuery.isError) {
    return (
      <ErrorState screen="topicsLoad"
        title="Couldn't load your topics"
        error={topicsQuery.error}
        action={{ label: "Try again", onSelect: () => void topicsQuery.refetch() }}
      />
    );
  }

  const { filters, sort } = view;
  const topics = topicsQuery.data ?? [];
  const counts = libraryFilterCounts(entries);
  const applied = appliedLibraryFilters(filters, topics);
  const topicNameById = new Map(topics.map((topic) => [topic.id, topic.name]));
  const changeFilters = (patch: Parameters<typeof applyLibraryFilterPatch>[1], from: FilterControl | null = null) => {
    if (from !== null) recordLibraryFilterChange(analytics.library.filters, filters, patch, from);
    changeView(applyLibraryFilterPatch(searchParams, patch));
  };
  const showAll = (from: FilterControl) => changeFilters(NO_LIBRARY_FILTERS, from);
  const resetView = () => {
    analytics.library.view.reset({ applied: applied.length });
    recordLibraryFilterChange(analytics.library.filters, filters, DEFAULT_LIBRARY_VIEW.filters, "reset");
    changeView(applyLibraryView(searchParams, DEFAULT_LIBRARY_VIEW));
  };
  const keepInPlace = (overviewId: string) => setKeptIds((kept) => new Set(kept).add(overviewId));
  const readerState = libraryViewState(searchParams, keptIds);
  const caughtUp = filters.status === "unread" && counts.unread === 0;

  // A row changed from the list stays where it is until the view changes, rather than
  // vanishing from under the pointer (docs/features/library-view.md).
  const visible = orderLibraryEntries(
    entries.filter((entry) => matchesLibraryFilters(entry, filters) || keptIds.has(libraryEntryId(entry))),
    sort,
  );
  searchSettled.current = () => analytics.library.search.searched({ results: visible.length });

  return (
    <div className={styles.root} data-testid={libraryPageTestIds.root}>
      <div className={styles.filterBar}>
        <button
          type="button"
          className={`${styles.filterButton} ${applied.length > 0 ? styles.filterButtonActive : ""}`}
          onClick={() => {
            analytics.library.filterSheet.opened();
            setFiltersOpen(true);
          }}
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
                onClick={() => changeFilters(chip.clear, "appliedChip")}
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
              onChange={(patch) => changeFilters(patch, "panel")}
              onNewTopic={() => {
                analytics.library.newTopicDialog.opened();
                setFiltersOpen(false);
                setNewTopicOpen(true);
              }}
            />
            {!railIsSheet && <div className={styles.milestones}>{milestoneStack}</div>}
          </div>
          <div className={styles.sheetFoot}>
            <button
              type="button"
              className={styles.clearAll}
              onClick={() => {
                analytics.library.filters.allCleared({ applied: applied.length });
                showAll("clearAll");
              }}
              data-testid={libraryPageTestIds.clearFiltersButton}
            >
              Show all
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
              <p className={styles.listCount}>
                <span data-testid={libraryPageTestIds.listCount}>
                  {libraryCountLine(counts, { savedHere: signedOutHere ? savedHere(surface) : null, phone })}
                </span>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  className={styles.timeSaved}
                  onClick={() => {
                    setTimeSavedOpen(true);
                    analytics.timeSaved.library.breakdownOpened();
                  }}
                  aria-haspopup="dialog"
                  aria-expanded={timeSavedOpen}
                  aria-label={`Time saved: ${spokenTimeSaved(timeSaved.minutes)}`}
                  data-testid={libraryPageTestIds.timeSavedButton}
                >
                  <TimeSavedFigure minutes={timeSaved.minutes} />
                  <span>saved</span>
                </button>
              </p>
            </div>
            <SortPill
              sort={sort}
              onChange={(next) => {
                analytics.library.sortPill.orderChosen({ sort: next });
                changeView(applyLibrarySort(searchParams, next));
              }}
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
                onClick={() => {
                  analytics.library.search.cleared();
                  changeFilters({ query: "" });
                }}
                testId={libraryPageTestIds.clearSearchButton}
              />
            )}
          </div>

          <div className={styles.viewLine}>
            <p className={styles.viewSummary} aria-live="polite" data-testid={libraryPageTestIds.viewSummary}>
              {libraryViewSummary(applied, sort)}
            </p>
            {!isSameLibraryView(view, DEFAULT_LIBRARY_VIEW) && (
              <button
                type="button"
                className={styles.viewAction}
                onClick={resetView}
                data-testid={libraryPageTestIds.resetViewButton}
              >
                Reset
              </button>
            )}
            {applied.length > 0 && (
              <button
                type="button"
                className={styles.viewAction}
                onClick={() => {
                  analytics.library.filters.allCleared({ applied: applied.length });
                  showAll("clearAll");
                }}
                data-testid={libraryPageTestIds.showAllButton}
              >
                Show all
              </button>
            )}
          </div>

          <LibraryQueueGroup />

          {railIsSheet && milestoneStack}

          {visible.length === 0 && caughtUp ? (
            <div className={styles.caughtUp} data-testid={libraryPageTestIds.caughtUp}>
              <p className={styles.caughtUpTitle}>You're all caught up</p>
              <p className={styles.caughtUpBody}>Every overview here is read.</p>
              <button
                type="button"
                className={styles.caughtUpAction}
                onClick={() => {
                  analytics.library.caughtUp.allShown();
                  showAll("caughtUp");
                }}
                data-testid={libraryPageTestIds.caughtUpShowAllButton}
              >
                Show all overviews
              </button>
            </div>
          ) : visible.length === 0 ? (
            <p className={styles.empty} data-testid={libraryPageTestIds.empty}>
              No overviews match these filters.
            </p>
          ) : (
            <div className={styles.list} data-testid={libraryPageTestIds.list}>
              {visible.map((entry) =>
                entry.kind === "unreadable" ? (
                  <LibraryUnreadableCard
                    key={entry.record.id}
                    onOpen={() => analytics.library.unreadableCard.opened()}
                    readerState={readerState}
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
                    onOpen={(from) => analytics.library.overviewCard.opened({ overviewId: entry.overview.id, from })}
                    readerState={readerState}
                    onToggleFavourite={() => {
                      analytics.library.overviewCard.favouriteSwitched({
                        overviewId: entry.overview.id,
                        favourite: !entry.state.favourite,
                      });
                      keepInPlace(entry.overview.id);
                      setOverviewState.mutate({
                        overviewId: entry.overview.id,
                        patch: { favourite: !entry.state.favourite },
                      });
                    }}
                    onToggleRead={() => {
                      analytics.library.overviewCard.readSwitched({ overviewId: entry.overview.id, read: !entry.state.read });
                      keepInPlace(entry.overview.id);
                      setOverviewState.mutate({
                        overviewId: entry.overview.id,
                        patch: { read: !entry.state.read },
                      });
                    }}
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

      <TimeSavedSheet
        open={timeSavedOpen}
        summary={timeSaved}
        onClose={() => {
          analytics.timeSaved.library.breakdownClosed();
          setTimeSavedOpen(false);
        }}
      />

      <NewTopicDialog
        open={newTopicOpen}
        unsorted={unsortedOverviews(readableEntries(entries).map((entry) => entry.overview))}
        busy={createTopic.isPending}
        onCreate={(input) => {
          createTopic.mutate(input, {
            onSuccess: (topic) => {
              analytics.library.newTopicDialog.created({ topicId: topic.id, filed: input.overviews.length });
              setNewTopicOpen(false);
            },
          });
        }}
        onPick={(overviewId, picked) => analytics.library.newTopicDialog.overviewPicked({ overviewId, picked })}
        onClose={() => {
          analytics.library.newTopicDialog.cancelled();
          setNewTopicOpen(false);
        }}
      />
    </div>
  );
}
