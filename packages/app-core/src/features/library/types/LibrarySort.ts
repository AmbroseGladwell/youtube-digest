export const LIBRARY_SORTS = ["newest", "oldest", "title"] as const;

export type LibrarySort = (typeof LIBRARY_SORTS)[number];

export const DEFAULT_LIBRARY_SORT: LibrarySort = "newest";

// What the narrow layout's sort button says once it is anything but the default; the default
// is the icon alone ("OV-84 2 Library Filter" 84v).
export const LIBRARY_SORT_SHORT_LABEL: Record<LibrarySort, string> = {
  newest: "",
  oldest: "Oldest",
  title: "A–Z",
};

export const LIBRARY_SORT_LABEL: Record<LibrarySort, string> = {
  newest: "Newest saved first",
  oldest: "Oldest saved first",
  title: "Title A–Z",
};
