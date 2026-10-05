import { LIBRARY_SORT_LABEL, type LibrarySort } from "../types/LibrarySort.js";
import type { AppliedLibraryFilter } from "./appliedLibraryFilters.js";

export function libraryViewSummary(applied: AppliedLibraryFilter[], sort: LibrarySort): string {
  const showing = applied.length === 0 ? "All overviews" : applied.map((filter) => filter.label).join(", ");
  return `Showing: ${showing} · ${LIBRARY_SORT_LABEL[sort]}`;
}
