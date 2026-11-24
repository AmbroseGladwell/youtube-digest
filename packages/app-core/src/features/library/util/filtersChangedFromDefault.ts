import type { LibraryFilters } from "../types/LibraryFilters.js";
import { DEFAULT_LIBRARY_VIEW } from "../types/LibraryView.js";

const SINGLE: readonly (keyof LibraryFilters)[] = ["added", "topicId", "status", "favourite", "dubious"];
const LISTS = ["kinds", "sources", "novelties", "tags"] as const;

// Each chosen value counts once, as each has its own chip.
export const filtersChangedFromDefault = (filters: LibraryFilters, defaults: LibraryFilters = DEFAULT_LIBRARY_VIEW.filters): number => {
  const singles = SINGLE.filter((key) => filters[key] !== defaults[key]).length;
  const lists = LISTS.reduce<number>(
    (sum, key) => sum + filters[key].filter((value) => !(defaults[key] as readonly string[]).includes(value)).length,
    0,
  );
  return singles + lists;
};
