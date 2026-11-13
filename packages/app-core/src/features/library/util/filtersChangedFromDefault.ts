import type { LibraryFilters } from "../types/LibraryFilters.js";
import { DEFAULT_LIBRARY_VIEW } from "../types/LibraryView.js";

const COUNTED: readonly (keyof LibraryFilters)[] = ["source", "topicId", "novelty", "status", "favourite", "dubious", "tag"];

// How many filters differ from the view the library opens on. The search is left out: its
// own field already shows it.
export function filtersChangedFromDefault(filters: LibraryFilters, defaults: LibraryFilters = DEFAULT_LIBRARY_VIEW.filters): number {
  return COUNTED.filter((key) => filters[key] !== defaults[key]).length;
}
