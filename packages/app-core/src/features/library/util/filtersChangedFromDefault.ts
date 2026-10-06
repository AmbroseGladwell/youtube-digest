import type { LibraryFilters } from "../types/LibraryFilters.js";
import { DEFAULT_LIBRARY_VIEW } from "../types/LibraryView.js";

const COUNTED: readonly (keyof LibraryFilters)[] = ["topicId", "novelty", "status", "favourite", "dubious", "tag"];

// How many filters differ from the view the library opens on. The search is left out: its
// own field already shows it.
export function filtersChangedFromDefault(filters: LibraryFilters): number {
  return COUNTED.filter((key) => filters[key] !== DEFAULT_LIBRARY_VIEW.filters[key]).length;
}
