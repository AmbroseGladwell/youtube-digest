export const appliedFiltersTestIds = {
  root: "AppliedFilters.root",
  group: (group: string) => `AppliedFilters.group.${group}`,
  remove: (key: string) => `AppliedFilters.remove.${key}`,
  clear: (group: string) => `AppliedFilters.clear.${group}`,
  more: (group: string) => `AppliedFilters.more.${group}`,
  edit: "AppliedFilters.edit",
  reset: "AppliedFilters.reset",
  showResults: "AppliedFilters.showResults",
};
