import { libraryEntrySavedAt, libraryEntryTitle, type LibraryEntry } from "../../overviews/types/LibraryEntry.js";
import type { LibrarySort } from "../types/LibrarySort.js";
import { libraryEntryDate, NO_LIBRARY_ACTIVITY, type LibraryActivity } from "./libraryEntryDate.js";
import { libraryTitleKey } from "./libraryTitleKey.js";

type Compare = (a: LibraryEntry, b: LibraryEntry) => number;

const unknownLast =
  <K>(key: (entry: LibraryEntry) => K | null, compare: (left: K, right: K) => number): Compare =>
  (a, b) => {
    const left = key(a);
    const right = key(b);
    if (left === null) {
      return right === null ? 0 : 1;
    }
    if (right === null) {
      return -1;
    }
    return compare(left, right);
  };

const titleOf = (entry: LibraryEntry): string | null => {
  const title = libraryEntryTitle(entry);
  return title === null ? null : libraryTitleKey(title);
};

const compareTitles = (left: string, right: string): number => left.localeCompare(right, undefined, { sensitivity: "base", numeric: true });

const newestSavedFirst = unknownLast(libraryEntrySavedAt, (left, right) => right.localeCompare(left));

// Unknown last whichever way it runs, ties newest saved first: docs/features/library-sort.md.
export const orderLibraryEntries = <T extends LibraryEntry>(
  entries: T[],
  sort: LibrarySort,
  activity: LibraryActivity = NO_LIBRARY_ACTIVITY,
): T[] => {
  const sign = sort.direction === "asc" ? 1 : -1;
  if (sort.field === "title") {
    const byTitle = unknownLast(titleOf, (left, right) => sign * compareTitles(left, right));
    return [...entries].sort((a, b) => byTitle(a, b) || newestSavedFirst(a, b));
  }
  const { field } = sort;
  const dated = new Map(entries.map((entry) => [entry, libraryEntryDate(entry, field, activity)] as const));
  const byDate = unknownLast(
    (entry) => dated.get(entry as T) ?? null,
    (left: number, right: number) => sign * (left - right),
  );
  return [...entries].sort((a, b) => byDate(a, b) || newestSavedFirst(a, b));
};
