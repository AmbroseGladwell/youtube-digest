export const LIBRARY_SORTS = ["newest", "oldest", "title"] as const;

export type LibrarySort = (typeof LIBRARY_SORTS)[number];

export const DEFAULT_LIBRARY_SORT: LibrarySort = "newest";

export const LIBRARY_SORT_LABEL: Record<LibrarySort, string> = {
  newest: "Newest saved first",
  oldest: "Oldest saved first",
  title: "Title A–Z",
};
