import { libraryEntryId, type LibraryEntry } from "../../overviews/types/LibraryEntry.js";

export interface OverviewNeighbours {
  position: number | null;
  total: number;
  previousId: string | null;
  nextId: string | null;
}

// An unreadable record is in the library, so it is in the sequence: skipping it would be
// the silent drop at navigation scale (docs/features/record-migrations.md).
export function overviewNeighbours(
  ordered: LibraryEntry[],
  overviewId: string,
): OverviewNeighbours {
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
