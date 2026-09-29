import { libraryEntrySavedAt, type LibraryEntry } from "../types/LibraryEntry.js";

// Newest saved first: the library's default order and the reader's Previous/Next, which
// does not follow a sort chosen in the library (docs/features/library-sort.md). A record
// whose saved date did not survive sorts last: an unknown date cannot claim a position
// (docs/features/record-migrations.md).
export function orderLibraryEntriesBySavedAt<T extends LibraryEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    const left = libraryEntrySavedAt(a);
    const right = libraryEntrySavedAt(b);
    if (left === null) return right === null ? 0 : 1;
    if (right === null) return -1;
    return right.localeCompare(left);
  });
}
