import {
  libraryEntrySavedAt,
  libraryEntryTitle,
  type LibraryEntry,
} from "../../overviews/types/LibraryEntry.js";
import { orderLibraryEntriesBySavedAt } from "../../overviews/util/orderLibraryEntriesBySavedAt.js";
import type { LibrarySort } from "../types/LibrarySort.js";

type Compare = (a: LibraryEntry, b: LibraryEntry) => number;

// An entry without the key sorts last whichever way the list runs: an unknown date or
// title cannot claim a position (docs/features/record-migrations.md).
const unknownLast =
  <K>(key: (entry: LibraryEntry) => K | null, compare: (left: K, right: K) => number): Compare =>
  (a, b) => {
    const left = key(a);
    const right = key(b);
    if (left === null) return right === null ? 0 : 1;
    if (right === null) return -1;
    return compare(left, right);
  };

const byTitle = unknownLast(libraryEntryTitle, (left, right) =>
  left.localeCompare(right, undefined, { sensitivity: "base", numeric: true }),
);
const oldestFirst = unknownLast(libraryEntrySavedAt, (left, right) => left.localeCompare(right));

export function orderLibraryEntries<T extends LibraryEntry>(entries: T[], sort: LibrarySort): T[] {
  const newest = orderLibraryEntriesBySavedAt(entries);
  switch (sort) {
    case "newest":
      return newest;
    case "oldest":
      return [...entries].sort(oldestFirst);
    case "title":
      return newest.sort(byTitle);
  }
}
