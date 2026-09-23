import { libraryEntrySavedAt, type LibraryEntry } from "../types/LibraryEntry.js";

// Newest saved first. The library list and the reader's Previous/Next share this so the
// "4 of 31" the reader shows is the position in the list the reader was opened from. A
// record whose saved date did not survive sorts last: an unknown date cannot claim a
// position (docs/features/record-migrations.md).
export function orderLibraryEntriesBySavedAt<T extends LibraryEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    const left = libraryEntrySavedAt(a);
    const right = libraryEntrySavedAt(b);
    if (left === null) return right === null ? 0 : 1;
    if (right === null) return -1;
    return right.localeCompare(left);
  });
}
