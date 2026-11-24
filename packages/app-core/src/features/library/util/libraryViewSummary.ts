import { LIBRARY_SORT_PRESET_LABEL, librarySortLabel, librarySortPresetOf, type LibrarySort } from "../types/LibrarySort.js";
import type { AppliedLibraryFilter } from "./appliedLibraryFilters.js";

export const libraryViewSummary = (applied: AppliedLibraryFilter[], sort: LibrarySort): string => {
  const showing = applied.length === 0 ? "All overviews" : applied.map((filter) => filter.label).join(", ");
  const preset = librarySortPresetOf(sort);
  return `Showing: ${showing} · ${preset === null ? librarySortLabel(sort) : LIBRARY_SORT_PRESET_LABEL[preset]}`;
};
