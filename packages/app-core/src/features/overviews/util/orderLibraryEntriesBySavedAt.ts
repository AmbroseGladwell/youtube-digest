import { libraryEntrySavedAt, type LibraryEntry } from "../types/LibraryEntry.js";

// Unknown dates last: docs/features/library-sort.md, "A record that can't claim a position sorts last".
export const orderLibraryEntriesBySavedAt = <T extends LibraryEntry>(entries: T[]): T[] => {
  return [...entries].sort((a, b) => {
    const left = libraryEntrySavedAt(a);
    const right = libraryEntrySavedAt(b);
    if (left === null) {
      return right === null ? 0 : 1;
    }
    if (right === null) {
      return -1;
    }
    return right.localeCompare(left);
  });
};
