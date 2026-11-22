import type { LibraryFilters } from "../types/LibraryFilters.js";
import { DEFAULT_LIBRARY_VIEW } from "../types/LibraryView.js";

const COUNTED: readonly (keyof LibraryFilters)[] = ["source", "topicId", "novelty", "status", "favourite", "dubious", "tag"];

export const filtersChangedFromDefault = (filters: LibraryFilters, defaults: LibraryFilters = DEFAULT_LIBRARY_VIEW.filters): number => {
  return COUNTED.filter((key) => filters[key] !== defaults[key]).length;
};
