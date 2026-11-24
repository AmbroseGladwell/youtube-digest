import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { timeSavedName, timeSavedSummary, type Overview, type OverviewId, type SelectionAction, type TopicId } from "@overview/domain";
import { usePlayer, usePlayerSnapshot } from "../../player/PlayerContext.js";
import { playerTrackFor } from "../../player/types/PlayerTrack.js";
import { useCreateTopicMutation } from "../../overviews/mutations/useCreateTopicMutation.js";
import { useSetOverviewStateMutation } from "../../overviews/mutations/useSetOverviewStateMutation.js";
import { ErrorState } from "../../../components/shared/ErrorState/ErrorState.js";
import { StrokeIcon } from "../../../components/shared/StrokeIcon/StrokeIcon.js";
import { Toast } from "../../../components/shared/Toast/Toast.js";
import { useToast } from "../../../components/shared/Toast/useToast.js";
import { bulkActionToast, type BulkAction } from "../util/bulkActionToast.js";
import { countFailed } from "../util/countFailed.js";
import { pickerAction, type PickerChange } from "../util/pickerAction.js";
import { useTopicsQuery } from "../../overviews/queries/topicsQuery.js";
import { libraryEntryId, readableEntries, type LibraryEntry } from "../../overviews/types/LibraryEntry.js";
import { topicCounts, unsortedOverviews } from "../../overviews/util/topicCounts.js";
import { FilterPanel } from "../components/FilterPanel/FilterPanel.js";
import { NewTopicDialog } from "../components/NewTopicDialog/NewTopicDialog.js";
import { ManageTagsDialog } from "../../tags/components/ManageTagsDialog/ManageTagsDialog.js";
import { SortPill } from "../components/SortPill/SortPill.js";
import { LibraryList } from "../components/LibraryList/LibraryList.js";
import { LibraryOverviewCard, type SaidMoment } from "../components/LibraryOverviewCard/LibraryOverviewCard.js";
import { libraryOverviewCardTestIds } from "../components/LibraryOverviewCard/LibraryOverviewCardTestIds.js";
import { LibraryCaptureCard } from "../components/LibraryCaptureCard/LibraryCaptureCard.js";
import { LibraryUnreadableCard } from "../components/LibraryUnreadableCard/LibraryUnreadableCard.js";
import { appliedLibraryFilters } from "../util/appliedLibraryFilters.js";
import { libraryFilterCounts } from "../util/libraryFilterCounts.js";
import {
  applyLibraryFilterPatch,
  applyLibrarySort,
  applyLibraryView,
  isSameLibraryView,
  parseLibraryView,
} from "../util/libraryFilterParams.js";
import { LibrarySearch, type LibrarySearchText } from "../components/LibrarySearch/LibrarySearch.js";
import { matchesLibraryFilters } from "../util/matchesLibraryFilters.js";
import { meaningEntries } from "../util/meaningEntries.js";
import { useMeaningMatchesQuery } from "../queries/meaningMatchesQuery.js";
import { useTranscriptMatchesQuery } from "../queries/transcriptMatchesQuery.js";
import { transcriptEntries } from "../util/transcriptEntries.js";
import { useSettledText } from "../../../util/useSettledText.js";
import { orderLibraryEntries } from "../util/orderLibraryEntries.js";
import { NO_LIBRARY_FILTERS, NO_LIBRARY_FILTERS as EVERY_OVERVIEW } from "../types/LibraryFilters.js";
import { DEFAULT_LIBRARY_VIEW } from "../types/LibraryView.js";
import { libraryViewState } from "../util/libraryViewState.js";
import { libraryViewSummary } from "../util/libraryViewSummary.js";
import { filtersChangedFromDefault } from "../util/filtersChangedFromDefault.js";
import { libraryFilterChips } from "../util/libraryFilterChips.js";
import { LibraryFilterChips } from "../components/LibraryFilterChips/LibraryFilterChips.js";
import { libraryRowGlideName, useLibraryGlide } from "./useLibraryGlide.js";
import "./libraryTransitions.scss";
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
import { useFirstOverviewMilestone } from "../../timeSaved/useFirstOverviewMilestone.js";
import { FirstOverviewMilestone } from "../../timeSaved/components/FirstOverviewMilestone/FirstOverviewMilestone.js";
import { useEnteringOverviewIds } from "./useEnteringOverviewIds.js";
import { LearnedNotice } from "../../settings/components/LearnedNotice/LearnedNotice.js";
import { libraryCountLine } from "../util/libraryCountLine.js";
import styles from "./LibraryPage.module.scss";
import { libraryPageTestIds } from "./LibraryPageTestIds.js";
import { LibraryQueueGroup } from "../../captureQueue/components/LibraryQueueGroup/LibraryQueueGroup.js";
import { useLibraryProjects } from "../../projects/useLibraryProjects.js";
import { WHOLE_LIBRARY, type LibraryPlace } from "../types/LibraryPlace.js";
import { DEFAULT_LIBRARY_SORT } from "../types/LibrarySort.js";
import { useSetOverviewTopicsMutation } from "../../overviews/mutations/useSetOverviewTopicsMutation.js";
import { useDeleteOverviewMutation } from "../../overviews/mutations/useDeleteOverviewMutation.js";
import { filedUnderTopic, unfiledFromTopic } from "../../overviews/util/filedUnderTopic.js";
import type { OverviewWithState } from "../../overviews/types/OverviewWithState.js";
import { SelectionBar } from "../components/SelectionBar/SelectionBar.js";
import { SelectionTopicsPicker } from "../components/SelectionTopicsPicker/SelectionTopicsPicker.js";
import { DeleteOverviewsDialog } from "../components/DeleteOverviewsDialog/DeleteOverviewsDialog.js";
import { useOverviewSelection } from "./useOverviewSelection.js";

const RAIL_SHEET_QUERY = "(max-width: 61.9375rem)";
const PHONE_QUERY = "(max-width: 47.9375rem)";
const QUERY_TO_URL_MS = 300;

export interface LibraryPageProps {
  entries: LibraryEntry[];
  place?: LibraryPlace;
}

const PROJECT_VIEW = { filters: EVERY_OVERVIEW, sort: DEFAULT_LIBRARY_SORT };

const selectionLineFor = (count: number, coarsePointer: boolean): string => {
  if (count > 0) {
    return `${count} selected`;
  }
  return coarsePointer ? "Tap to select" : "Click to select";
};

const searchPlaceholderFor = (filtered: boolean, sortedOnSheet: boolean): string => {
  if (filtered) {
    return "Search within these";
  }
  return sortedOnSheet ? "Search overviews" : "Search claims, channels, tags";
};

export const LibraryPage = ({ entries: allEntries, place = WHOLE_LIBRARY }: LibraryPageProps) => {
  const topicsQuery = useTopicsQuery();
  const { searchParams, view, change } = useLibraryView(topicsQuery.data, { remember: place.kind === "library" });
  // Why the URL follows the field: docs/features/library-view.md, "Search".
  const [query, setQuery] = useState(view.filters.query);
  const [searchText, setSearchText] = useState<LibrarySearchText>({ text: query, revision: 0 });
  const queryWrites = useRef<string[]>([]);
  const showInSearch = (text: string) => setSearchText((shown) => ({ text, revision: shown.revision + 1 }));
  const viewParams = query === view.filters.query ? searchParams : applyLibraryFilterPatch(searchParams, { query });
  const writeView = (next: URLSearchParams) => {
    const nextQuery = parseLibraryView(next).filters.query;
    if (nextQuery !== view.filters.query) {
      queryWrites.current.push(nextQuery);
    }
    change(next);
  };
  const settledTyping = useSettledText(query, QUERY_TO_URL_MS);
  useEffect(() => {
    if (settledTyping !== query || query === view.filters.query) {
      return;
    }
    writeView(applyLibraryFilterPatch(searchParams, { query }));
  }, [settledTyping]);
  useEffect(() => {
    const written = queryWrites.current.indexOf(view.filters.query);
    if (written !== -1) {
      queryWrites.current.splice(0, written + 1);
      return;
    }
    if (view.filters.query === query) {
      return;
    }
    setQuery(view.filters.query);
    showInSearch(view.filters.query);
  }, [view.filters.query]);
  const selection = useOverviewSelection(place.kind === "project" ? place.projectId : place.kind);
  const toast = useToast();
  const main = useRef<HTMLElement | null>(null);
  const projects = useLibraryProjects(place, readableEntries(allEntries), {
    say: (text, undo) => toast.show(text, true, undo),
    focusList: () => main.current?.querySelector<HTMLElement>(`[data-testid="${libraryOverviewCardTestIds.titleLink}"]`)?.focus(),
    selecting: selection.selecting,
  });
  const entries = projects.inScope === null ? allEntries : allEntries.filter((entry) => projects.inScope!.has(libraryEntryId(entry)));
  const defaultView = place.kind === "library" ? DEFAULT_LIBRARY_VIEW : PROJECT_VIEW;
  const [keptIds, setKeptIds] = useState<ReadonlySet<string>>(new Set());
  const glide = useLibraryGlide(main, searchParams.toString());
  const changeView = (next: URLSearchParams) =>
    glide(() => {
      setKeptIds(new Set());
      const nextQuery = parseLibraryView(next).filters.query;
      if (nextQuery !== query) {
        setQuery(nextQuery);
        showInSearch(nextQuery);
      }
      writeView(next);
    });
  const setOverviewState = useSetOverviewStateMutation();
  const setOverviewTopics = useSetOverviewTopicsMutation();
  const deleteOverview = useDeleteOverviewMutation();
  const [choosingTopics, setChoosingTopics] = useState(false);
  const topicSession = useRef<{ changes: Map<string, PickerChange>; writes: Promise<unknown>[] }>({ changes: new Map(), writes: [] });
  const selectButton = useRef<HTMLButtonElement | null>(null);
  const refocusSelect = useRef(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const player = usePlayer();
  const playerSnapshot = usePlayerSnapshot();

  const isPlaying = (overviewId: OverviewId) =>
    playerSnapshot.track?.overviewId === overviewId && ["playing", "buffering", "preparing"].includes(playerSnapshot.status);
  const listen = (overview: Overview) => {
    analytics.library.overviewCard.listenPressed({ overviewId: overview.id, listening: !isPlaying(overview.id) });
    if (playerSnapshot.track?.overviewId === overview.id) {
      player.toggle("libraryRow");
      return;
    }
    player.load(playerTrackFor(overview));
    player.play("libraryRow");
  };
  const createTopic = useCreateTopicMutation();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const rail = useRef<HTMLElement | null>(null);
  const [newTopicOpen, setNewTopicOpen] = useState(false);
  const [manageTagsOpen, setManageTagsOpen] = useState(false);
  const [timeSavedOpen, setTimeSavedOpen] = useState(false);
  const analytics = useAnalytics();
  const searchSettled = useRef(() => {});
  useTypingSettled(query, () => searchSettled.current());
  const settledQuery = useSettledText(query.trim());
  const meaningQuery = useMeaningMatchesQuery(settledQuery);
  const meaningSettled = useRef(() => {});
  const meaningHeadingId = useId();
  useEffect(() => {
    if (meaningQuery.data !== undefined && settledQuery !== "") {
      meaningSettled.current();
    }
  }, [meaningQuery.data, settledQuery]);
  const transcriptQuery = useTranscriptMatchesQuery(settledQuery);
  const transcriptSettled = useRef(() => {});
  const saidHeadingId = useId();
  useEffect(() => {
    if ((transcriptQuery.data !== undefined || transcriptQuery.isError) && settledQuery !== "") {
      transcriptSettled.current();
    }
  }, [transcriptQuery.data, transcriptQuery.isError, settledQuery]);
  const railIsSheet = useMediaQuery(RAIL_SHEET_QUERY);
  const isPhone = useMediaQuery(PHONE_QUERY);
  const coarsePointer = useMediaQuery("(pointer: coarse)");
  const timeSaved = timeSavedSummary(readableEntries(entries));
  const milestones = useMilestones(timeSaved.minutes, true);
  // A sample isn't the reader's first overview: docs/features/onboarding.md, "Try a sample".
  const firstOverview = useFirstOverviewMilestone(readableEntries(entries).filter(({ overview }) => !overview.fromSample).length);
  const milestoneStack = (
    <>
      <MilestoneStack
        milestones={milestones.visible}
        minutes={timeSaved.minutes}
        onLineChosen={milestones.lineChosen}
        onDismiss={milestones.dismiss}
        onUndo={milestones.undo}
      />
      {firstOverview.shown && <FirstOverviewMilestone onDismiss={firstOverview.dismiss} />}
    </>
  );

  const entering = useEnteringOverviewIds(entries.map(libraryEntryId));
  const closeFilters = () => {
    if (filtersOpen) {
      analytics.library.filterSheet.closed();
    }
    setFiltersOpen(false);
  };
  useFocusTrap(filtersOpen, rail);
  useDismissOnOutside(filtersOpen, closeFilters, rail);
  useEffect(() => {
    if (selection.selecting || !refocusSelect.current) {
      return;
    }
    refocusSelect.current = false;
    selectButton.current?.focus();
  }, [selection.selecting]);

  if (topicsQuery.isError) {
    return (
      <ErrorState
        screen="topicsLoad"
        title="Couldn't load your topics"
        error={topicsQuery.error}
        action={{ label: "Try again", onSelect: () => void topicsQuery.refetch() }}
      />
    );
  }

  const { sort } = view;
  const filters = { ...view.filters, query };
  const topics = topicsQuery.data ?? [];
  const counts = libraryFilterCounts(entries);
  const applied = appliedLibraryFilters(filters, topics);
  const topicNameById = new Map(topics.map((topic) => [topic.id, topic.name]));
  const changeFilters = (patch: Parameters<typeof applyLibraryFilterPatch>[1], from: FilterControl | null = null) => {
    if (from !== null) {
      recordLibraryFilterChange(analytics.library.filters, filters, patch, from);
    }
    changeView(applyLibraryFilterPatch(viewParams, patch));
  };
  const showAll = (from: FilterControl) => changeFilters(NO_LIBRARY_FILTERS, from);
  const resetView = () => {
    analytics.library.view.reset({ applied: applied.length });
    recordLibraryFilterChange(analytics.library.filters, filters, defaultView.filters, "reset");
    changeView(applyLibraryView(viewParams, defaultView));
  };
  const keepInPlace = (overviewId: string) => setKeptIds((kept) => new Set(kept).add(overviewId));
  const readerState = libraryViewState(viewParams, keptIds);
  const caughtUp = filters.status === "unread" && counts.unread === 0;
  const changedFilters = filtersChangedFromDefault(filters, defaultView.filters);
  const chips = libraryFilterChips(filters, topics, defaultView.filters);

  // Why a changed row stays put: docs/features/library-view.md, "Show all, Reset, caught up".
  const visible = orderLibraryEntries(
    entries.filter((entry) => matchesLibraryFilters(entry, filters) || keptIds.has(libraryEntryId(entry))),
    sort,
  );
  searchSettled.current = () => analytics.library.search.searched({ results: visible.length });
  const settledIsCurrent = settledQuery !== "" && settledQuery === filters.query.trim();
  const saidInSource = settledIsCurrent
    ? transcriptEntries(entries, filters, transcriptQuery.data, new Set(visible.map(libraryEntryId)))
    : [];
  const transcriptsUnavailable = settledIsCurrent && transcriptQuery.isError;
  transcriptSettled.current = () =>
    analytics.library.search.transcriptMatched({ transcriptOnly: saidInSource.length, failed: transcriptQuery.isError });
  const closeInMeaning = settledIsCurrent
    ? meaningEntries(
        entries,
        filters,
        meaningQuery.data,
        new Set([...visible.map(libraryEntryId), ...saidInSource.map(({ overview }) => overview.id)]),
      )
    : [];
  const meaningUnavailable = settledIsCurrent && meaningQuery.data?.available === false;
  meaningSettled.current = () =>
    analytics.library.search.meaningMatched({ meaningOnly: closeInMeaning.length, available: meaningQuery.data?.available ?? false });
  const unreadShown = visible.filter((entry) => !entry.state.read).length;
  const selected: OverviewWithState[] = [...visible, ...saidInSource, ...closeInMeaning].filter(
    (entry): entry is LibraryEntry & OverviewWithState => entry.kind === "overview" && selection.picked.has(entry.overview.id),
  );
  const selectable = readableEntries(entries).length > 0;
  const allRead = selected.length > 0 && selected.every((entry) => entry.state.read);
  const allFavourite = selected.length > 0 && selected.every((entry) => entry.state.favourite);
  const selectionLine = selectionLineFor(selected.length, coarsePointer);
  const stopSelecting = () => {
    analytics.library.selection.stopped({ selected: selected.length, reason: "reader" });
    selection.stop();
  };
  const acted = (action: SelectionAction) => analytics.library.selection.acted({ action, overviews: selected.length });
  const finishActing = (action: SelectionAction, done: BulkAction, writes: Promise<unknown>[], overviews: number) => {
    analytics.library.selection.stopped({ selected: overviews, reason: "acted" });
    refocusSelect.current = true;
    selection.stop();
    void countFailed(writes).then((failed) => {
      if (failed > 0) {
        analytics.library.selection.failed({ action, failed, writes: writes.length });
      }
      const { text, done: succeeded } = bulkActionToast(done, { writes: writes.length, failed });
      toast.show(text, succeeded);
    });
  };
  const setSelectedState = (patch: { read: boolean } | { favourite: boolean }): Promise<unknown>[] => {
    const writes: Promise<unknown>[] = [];
    for (const entry of selected) {
      const [key, value] = Object.entries(patch)[0] as ["read" | "favourite", boolean];
      if (entry.state[key] === value) {
        continue;
      }
      keepInPlace(entry.overview.id);
      writes.push(setOverviewState.mutateAsync({ overviewId: entry.overview.id, patch }));
    }
    return writes;
  };
  const changeSelectedTopic = (topicId: TopicId, give: boolean) => {
    analytics.library.selection.topicChanged({ topicId, given: give, overviews: selected.length });
    const { changes, writes } = topicSession.current;
    const change = changes.get(topicId);
    if (change === undefined) {
      const place = topics.find((topic) => topic.id === topicId)?.name ?? "";
      changes.set(topicId, {
        place,
        heldBefore: selected.filter(({ overview }) => overview.topicIds.includes(topicId)).length,
        given: give,
      });
    } else {
      change.given = give;
    }
    for (const { overview } of selected) {
      if (overview.topicIds.includes(topicId) === give) {
        continue;
      }
      keepInPlace(overview.id);
      writes.push(
        setOverviewTopics.mutateAsync({
          overview,
          topicIds: (give ? filedUnderTopic(overview, topicId) : unfiledFromTopic(overview, topicId)).topicIds,
        }),
      );
    }
  };
  const createSelectedTopic = (name: string) => {
    const write = createTopic.mutateAsync({ name, overviews: selected.map(({ overview }) => overview) });
    void write.then(
      (topic) => analytics.library.selection.topicChanged({ topicId: topic.id, given: true, overviews: selected.length }),
      () => undefined,
    );
    topicSession.current.changes.set(`new:${name}`, { place: name, heldBefore: 0, given: true });
    topicSession.current.writes.push(write);
  };
  const finishChoosingTopics = () => {
    setChoosingTopics(false);
    const { changes, writes } = topicSession.current;
    const done = pickerAction(changes.values(), selected.length, "topic");
    if (done !== null) {
      finishActing("addToTopic", done, writes, selected.length);
    }
  };

  const countLine =
    filters.tag === null ? (
      libraryCountLine(counts)
    ) : (
      <>
        {visible.length} {visible.length === 1 ? "overview" : "overviews"}
        <span className={styles.visuallyHidden}> tagged #{filters.tag}</span> · {unreadShown} unread
      </>
    );
  const row = (entry: LibraryEntry, order: number, said: SaidMoment | null = null) => (
    <div
      key={libraryEntryId(entry)}
      data-glide-name={libraryRowGlideName(libraryEntryId(entry))}
      className={selection.selecting && entry.kind !== "overview" ? styles.notSelectable : undefined}
      inert={selection.selecting && entry.kind !== "overview"}
    >
      {entry.kind === "capture" && (
        <LibraryCaptureCard
          capture={entry.capture}
          entering={entering.has(entry.capture.id)}
          readerState={readerState}
          onOpen={() => undefined}
        />
      )}
      {entry.kind === "unreadable" && (
        <LibraryUnreadableCard
          onOpen={() => analytics.library.unreadableCard.opened()}
          readerState={readerState}
          record={entry.record}
          entering={entering.has(entry.record.id)}
        />
      )}
      {entry.kind === "overview" && (
        <LibraryOverviewCard
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
          addedBy={projects.addedByFor(entry.overview.id)}
          said={said}
          selection={
            selection.selecting
              ? { selected: selection.picked.has(entry.overview.id), onToggle: () => selection.toggle(entry.overview.id), order }
              : null
          }
        />
      )}
    </div>
  );
  const timeSavedButton = (
    <button
      type="button"
      className={styles.timeSaved}
      onClick={() => {
        setTimeSavedOpen(true);
        analytics.timeSaved.library.breakdownOpened();
      }}
      aria-haspopup="dialog"
      aria-expanded={timeSavedOpen}
      aria-label={timeSavedName(timeSaved.minutes)}
      data-testid={libraryPageTestIds.timeSavedButton}
    >
      <TimeSavedFigure minutes={timeSaved.minutes} />
      <span>saved</span>
    </button>
  );
  const sortControl = (
    <SortPill
      sort={sort}
      compact={railIsSheet}
      onChange={(next) => {
        analytics.library.sortPill.orderChosen({ sort: next });
        changeView(applyLibrarySort(viewParams, next));
      }}
    />
  );
  const searchPlaceholder = searchPlaceholderFor(chips.length > 0, railIsSheet && sort !== DEFAULT_LIBRARY_VIEW.sort);
  const listShown = place.kind !== "projects" && !projects.missing && !(place.kind === "project" && projects.current === null);
  const notListed = (): ReactNode => {
    if (place.kind === "projects") {
      return projects.index;
    }
    return projects.missing ? <ErrorState screen="notFound" title="This project isn't here any more" back /> : null;
  };
  const listBody = (): ReactNode => {
    if (visible.length === 0 && caughtUp) {
      return (
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
      );
    }
    if (visible.length === 0) {
      return (
        closeInMeaning.length === 0 &&
        saidInSource.length === 0 && (
          <p className={styles.empty} data-testid={libraryPageTestIds.empty}>
            No overviews match these filters.
          </p>
        )
      );
    }
    return <LibraryList entries={visible} keyOf={libraryEntryId} row={row} testId={libraryPageTestIds.list} />;
  };

  return (
    <div className={styles.root} data-testid={libraryPageTestIds.root}>
      <LearnedNotice />
      <div className={styles.grid}>
        <aside
          ref={rail}
          className={`${styles.rail} ${filtersOpen ? styles.railOpen : ""}`}
          aria-label="Filters"
          inert={railIsSheet && !filtersOpen}
          data-testid={libraryPageTestIds.rail}
        >
          <span className={styles.sheetHandle} aria-hidden="true" />
          <div className={styles.sheetHead}>
            <h2 className={styles.sheetTitle}>Filters</h2>
            <button
              type="button"
              className={styles.sheetClose}
              onClick={closeFilters}
              aria-label="Close"
              data-testid={libraryPageTestIds.closeFiltersButton}
            >
              <StrokeIcon name="close" size={18} />
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
              onManageTags={() => {
                analytics.library.manageTags.opened();
                setFiltersOpen(false);
                setManageTagsOpen(true);
              }}
              projects={<div onClickCapture={() => setFiltersOpen(false)}>{projects.railGroup}</div>}
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
              Clear all
            </button>
            <button type="button" className={styles.showResults} onClick={closeFilters} data-testid={libraryPageTestIds.showResultsButton}>
              Show {visible.length} {visible.length === 1 ? "overview" : "overviews"}
            </button>
          </div>
          {counts.unreadable > 0 && <p className={styles.sheetNote}>{counts.unreadable} couldn't be read, so no filter can match them.</p>}
        </aside>

        <main className={styles.main} ref={main}>
          {listShown ? (
            <>
              {projects.head ?? (
                <div className={styles.listHead}>
                  <div className={styles.titleBlock}>
                    <div className={styles.titleRow}>
                      <h1 className={styles.title}>Overviews</h1>
                      {railIsSheet && <span className={styles.timeSavedSlot}>{timeSavedButton}</span>}
                    </div>
                    <p className={`${styles.listCount} ${selection.selecting ? styles.listCountSelecting : ""}`} aria-live="polite">
                      <span data-testid={libraryPageTestIds.listCount}>{selection.selecting ? selectionLine : countLine}</span>
                      {!railIsSheet && !selection.selecting && (
                        <>
                          <span aria-hidden="true">·</span>
                          {timeSavedButton}
                        </>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {projects.suggestions}

              {projects.empty === null && (
                <>
                  <LibrarySearch
                    text={searchText}
                    onType={(typed) => {
                      setQuery(typed);
                      setKeptIds((kept) => (kept.size === 0 ? kept : new Set()));
                    }}
                    onClearPressed={() => analytics.library.search.cleared()}
                    isPhone={isPhone}
                    placeholder={projects.current === null ? searchPlaceholder : `Search in ${projects.current.project.name}`}
                  >
                    {sortControl}
                    <button
                      type="button"
                      className={styles.filterButton}
                      onClick={() => {
                        analytics.library.filterSheet.opened();
                        setFiltersOpen(true);
                      }}
                      aria-label={changedFilters === 0 ? "Filters" : `Filters, ${changedFilters} changed`}
                      aria-expanded={filtersOpen}
                      data-testid={libraryPageTestIds.filterButton}
                    >
                      <StrokeIcon name="filter" size={17} />
                      {changedFilters > 0 && <span className={styles.filterDot} aria-hidden="true" />}
                    </button>
                    {selectable && (
                      <button
                        ref={selectButton}
                        type="button"
                        className={styles.selectButton}
                        onClick={() => {
                          if (selection.selecting) {
                            stopSelecting();
                          } else {
                            analytics.library.selection.started();
                            selection.start();
                          }
                        }}
                        aria-pressed={selection.selecting}
                        aria-label={selection.selecting ? "Stop selecting" : "Select"}
                        title={selection.selecting ? "Stop selecting" : "Select"}
                        data-testid={libraryPageTestIds.selectButton}
                      >
                        <span className={styles.selectIcon} aria-hidden="true">
                          <StrokeIcon name="squareCheck" size={16} />
                        </span>
                        <span className={styles.stopIcon} aria-hidden="true">
                          <StrokeIcon name="close" size={16} />
                        </span>
                      </button>
                    )}
                  </LibrarySearch>

                  {selection.selecting && projects.current !== null && (
                    <p className={styles.selectionLine} aria-live="polite" data-testid={libraryPageTestIds.selectionLine}>
                      {selectionLine}
                    </p>
                  )}

                  <LibraryFilterChips
                    chips={chips}
                    onRemove={(chip) => changeFilters(chip.clear, "filterChip")}
                    onMore={() => {
                      if (railIsSheet) {
                        analytics.library.filterSheet.opened();
                        setFiltersOpen(true);
                      } else {
                        rail.current?.querySelector<HTMLButtonElement>("[aria-controls]")?.focus();
                      }
                    }}
                  />

                  <div className={styles.viewLine}>
                    <p className={styles.viewSummary} aria-live="polite" data-testid={libraryPageTestIds.viewSummary}>
                      {libraryViewSummary(applied, sort)}
                    </p>
                    {!isSameLibraryView({ filters, sort }, defaultView) && (
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
                </>
              )}

              {projects.current === null && <LibraryQueueGroup />}

              {railIsSheet && projects.current === null && milestoneStack}

              {projects.empty ?? listBody()}
              {saidInSource.length > 0 && (
                <section className={styles.meaning} aria-labelledby={saidHeadingId} data-testid={libraryPageTestIds.saidGroup}>
                  <h2 className={styles.meaningHeading} id={saidHeadingId}>
                    Said in the transcripts
                  </h2>
                  <p className={styles.meaningSub}>Your words aren't in these overviews, but they were said.</p>
                  <div className={styles.list}>
                    {saidInSource.map((entry, index) =>
                      row(entry, visible.length + index, {
                        moment: entry.moment,
                        sourceWord: entry.overview.source.kind === "podcast" ? "episode" : "video",
                      }),
                    )}
                  </div>
                </section>
              )}
              {closeInMeaning.length > 0 && (
                <section className={styles.meaning} aria-labelledby={meaningHeadingId} data-testid={libraryPageTestIds.meaningGroup}>
                  <h2 className={styles.meaningHeading} id={meaningHeadingId}>
                    Close in meaning
                  </h2>
                  <p className={styles.meaningSub}>These don't use your words, but they're about something close.</p>
                  <div className={styles.list}>
                    {closeInMeaning.map((entry, index) => row(entry, visible.length + saidInSource.length + index))}
                  </div>
                </section>
              )}
              {transcriptsUnavailable && (
                <p className={styles.meaningSub} data-testid={libraryPageTestIds.transcriptsUnavailable}>
                  Couldn't search what was said in your videos and episodes just now.
                </p>
              )}
              {meaningUnavailable && (
                <p className={styles.meaningSub} data-testid={libraryPageTestIds.meaningUnavailable}>
                  Couldn't search by meaning just now, so these match your words only.
                </p>
              )}
              {selection.selecting && (
                <SelectionBar
                  count={selected.length}
                  iconsOnly={isPhone}
                  allRead={allRead}
                  allFavourite={allFavourite}
                  projectName={projects.current?.project.name ?? null}
                  onAddToProject={() => {
                    acted("addToProject");
                    const overviews = selected.length;
                    projects.fileSelection(selected, (done, writes) => {
                      if (done !== null) {
                        finishActing("addToProject", done, writes, overviews);
                      }
                    });
                  }}
                  onAddToTopic={() => {
                    acted("addToTopic");
                    topicSession.current = { changes: new Map(), writes: [] };
                    setChoosingTopics(true);
                  }}
                  onToggleRead={() => {
                    const action = allRead ? "markUnread" : "markRead";
                    acted(action);
                    const writes = setSelectedState({ read: !allRead });
                    finishActing(action, { kind: allRead ? "unread" : "read", overviews: selected.length }, writes, selected.length);
                  }}
                  onToggleFavourite={() => {
                    const action = allFavourite ? "unfavourite" : "favourite";
                    acted(action);
                    const writes = setSelectedState({ favourite: !allFavourite });
                    finishActing(action, { kind: action, overviews: selected.length }, writes, selected.length);
                  }}
                  onRemoveFromProject={() => {
                    acted("removeFromProject");
                    const ids = selected.map(({ overview }) => overview.id);
                    const writes = projects.removeFromCurrent(ids);
                    const place = projects.current?.project.name ?? "";
                    finishActing("removeFromProject", { kind: "removed", overviews: ids.length, place }, writes, ids.length);
                  }}
                  onDelete={() => {
                    acted("delete");
                    setConfirmingDelete(true);
                  }}
                />
              )}
            </>
          ) : (
            notListed()
          )}
        </main>
      </div>

      <div
        className={`${styles.scrim} ${filtersOpen ? styles.scrimOpen : ""}`}
        onClick={closeFilters}
        aria-hidden="true"
        data-testid={libraryPageTestIds.scrim}
      />

      <TimeSavedSheet
        open={timeSavedOpen}
        summary={timeSaved}
        onClose={() => {
          analytics.timeSaved.library.breakdownClosed();
          setTimeSavedOpen(false);
        }}
      />

      <ManageTagsDialog open={manageTagsOpen} entries={readableEntries(allEntries)} onClose={() => setManageTagsOpen(false)} />

      <NewTopicDialog
        open={newTopicOpen}
        unsorted={unsortedOverviews(readableEntries(allEntries).map((entry) => entry.overview))}
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

      {projects.dialogs}

      {choosingTopics && (
        <SelectionTopicsPicker
          topics={topics}
          overviews={selected}
          countByTopic={topicCounts(readableEntries(allEntries).map((entry) => entry.overview))}
          onToggle={changeSelectedTopic}
          onCreate={createSelectedTopic}
          onClose={finishChoosingTopics}
        />
      )}

      {confirmingDelete && (
        <DeleteOverviewsDialog
          count={selected.length}
          onDelete={() => {
            analytics.library.selection.deleted({ overviews: selected.length });
            const ids = selected.map(({ overview }) => overview.id);
            const writes = ids.map((overviewId) => deleteOverview.mutateAsync({ overviewId }));
            setConfirmingDelete(false);
            finishActing("delete", { kind: "deleted", overviews: ids.length }, writes, ids.length);
          }}
          onClose={() => {
            analytics.library.selection.deleteKept();
            setConfirmingDelete(false);
          }}
        />
      )}

      <Toast toast={toast.toast} onDismiss={toast.dismiss} />
    </div>
  );
};
