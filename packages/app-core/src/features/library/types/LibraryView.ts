import { NO_LIBRARY_FILTERS, type LibraryFilters } from "./LibraryFilters.js";
import { DEFAULT_LIBRARY_SORT, type LibrarySort } from "./LibrarySort.js";

export interface LibraryView {
  filters: LibraryFilters;
  sort: LibrarySort;
}

export const DEFAULT_LIBRARY_VIEW: LibraryView = {
  filters: { ...NO_LIBRARY_FILTERS, status: "unread" },
  sort: DEFAULT_LIBRARY_SORT,
};

export const SAVED_LIBRARY_VIEW_FIELDS = ["topic", "novelty", "status", "favourite", "dubious", "sort"] as const;

export type SavedLibraryViewField = (typeof SAVED_LIBRARY_VIEW_FIELDS)[number];
