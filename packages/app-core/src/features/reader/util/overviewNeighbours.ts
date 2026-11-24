import { libraryEntryId, type LibraryEntry } from "../../overviews/types/LibraryEntry.js";
import { orderLibraryEntriesBySavedAt } from "../../overviews/util/orderLibraryEntriesBySavedAt.js";
import { matchesLibraryFilters } from "../../library/util/matchesLibraryFilters.js";
import { orderLibraryEntries } from "../../library/util/orderLibraryEntries.js";
import type { SteppedLibraryView } from "../../library/util/libraryViewState.js";
import { NO_LIBRARY_ACTIVITY, type LibraryActivity } from "../../library/util/libraryEntryDate.js";

export interface OverviewNeighbours {
  position: number | null;
  total: number;
  previousId: string | null;
  nextId: string | null;
}

// Why passed overviews stay in the sequence: docs/features/library-view.md, "The reader steps through it".
export const overviewNeighbours = (
  entries: LibraryEntry[],
  overviewId: string,
  stepped: Pick<SteppedLibraryView, "view" | "kept"> | null = null,
  activity: LibraryActivity = NO_LIBRARY_ACTIVITY,
): OverviewNeighbours => {
  const ordered =
    stepped === null
      ? orderLibraryEntriesBySavedAt(entries)
      : orderLibraryEntries(
          entries.filter((entry) => {
            const id = libraryEntryId(entry);
            return id === overviewId || stepped.kept.has(id) || matchesLibraryFilters(entry, stepped.view.filters);
          }),
          stepped.view.sort,
          activity,
        );
  const index = ordered.findIndex((entry) => libraryEntryId(entry) === overviewId);
  if (index === -1) {
    return { position: null, total: ordered.length, previousId: null, nextId: null };
  }
  const previous = ordered[index - 1];
  const next = ordered[index + 1];
  return {
    position: index + 1,
    total: ordered.length,
    previousId: previous === undefined ? null : libraryEntryId(previous),
    nextId: next === undefined ? null : libraryEntryId(next),
  };
};
