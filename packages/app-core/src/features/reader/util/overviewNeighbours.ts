import { libraryEntryId, type LibraryEntry } from "../../overviews/types/LibraryEntry.js";
import { orderLibraryEntriesBySavedAt } from "../../overviews/util/orderLibraryEntriesBySavedAt.js";
import { matchesLibraryFilters } from "../../library/util/matchesLibraryFilters.js";
import { orderLibraryEntries } from "../../library/util/orderLibraryEntries.js";
import type { SteppedLibraryView } from "../../library/util/libraryViewState.js";

export interface OverviewNeighbours {
  position: number | null;
  total: number;
  previousId: string | null;
  nextId: string | null;
}

// An unreadable record is in the library, so it is in the sequence: skipping it would be
// the silent drop at navigation scale (docs/features/record-migrations.md). Opened from the
// list, it walks that list's view, keeping the overview in hand and every one already passed
// even once they no longer match, as marking one read does to an unread list
// (docs/features/library-view.md).
export function overviewNeighbours(
  entries: LibraryEntry[],
  overviewId: string,
  stepped: Pick<SteppedLibraryView, "view" | "kept"> | null = null,
): OverviewNeighbours {
  const ordered =
    stepped === null
      ? orderLibraryEntriesBySavedAt(entries)
      : orderLibraryEntries(
          entries.filter((entry) => {
            const id = libraryEntryId(entry);
            return id === overviewId || stepped.kept.has(id) || matchesLibraryFilters(entry, stepped.view.filters);
          }),
          stepped.view.sort,
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
}
