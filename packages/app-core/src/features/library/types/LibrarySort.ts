export const LIBRARY_SORT_FIELDS = ["added", "published", "updated", "title"] as const;
export type LibrarySortField = (typeof LIBRARY_SORT_FIELDS)[number];

export const LIBRARY_SORT_DIRECTIONS = ["desc", "asc"] as const;
export type LibrarySortDirection = (typeof LIBRARY_SORT_DIRECTIONS)[number];

export const LIBRARY_GROUPS = ["none", "day", "week", "month", "letter"] as const;
export type LibraryGroup = (typeof LIBRARY_GROUPS)[number];

export interface LibrarySort {
  field: LibrarySortField;
  direction: LibrarySortDirection;
  group: LibraryGroup;
}

export const DEFAULT_LIBRARY_SORT: LibrarySort = { field: "added", direction: "desc", group: "none" };

export const isDateSortField = (field: LibrarySortField): boolean => field !== "title";

export const defaultDirectionOf = (field: LibrarySortField): LibrarySortDirection => (field === "title" ? "asc" : "desc");

// Day, week and month group a date; letter groups a title: docs/features/library-sort.md, "Group by".
export const groupsFor = (field: LibrarySortField): readonly LibraryGroup[] =>
  isDateSortField(field) ? ["none", "day", "week", "month"] : ["none", "letter"];

export const isDefaultLibrarySort = (sort: LibrarySort): boolean =>
  sort.field === DEFAULT_LIBRARY_SORT.field &&
  sort.direction === DEFAULT_LIBRARY_SORT.direction &&
  sort.group === DEFAULT_LIBRARY_SORT.group;

export const isSameLibrarySort = (left: LibrarySort, right: LibrarySort): boolean =>
  left.field === right.field && left.direction === right.direction && left.group === right.group;

export const LIBRARY_SORT_FIELD_LABEL: Record<LibrarySortField, string> = {
  added: "Added",
  published: "Published",
  updated: "Updated",
  title: "Title",
};

const DIRECTION_LABEL: Record<"date" | "title", Record<LibrarySortDirection, string>> = {
  date: { desc: "newest first", asc: "oldest first" },
  title: { asc: "A–Z", desc: "Z–A" },
};

const GROUP_LABEL: Record<LibraryGroup, string> = { none: "", day: "by day", week: "by week", month: "by month", letter: "by letter" };

export const libraryDirectionLabel = (sort: Pick<LibrarySort, "field" | "direction">): string =>
  DIRECTION_LABEL[isDateSortField(sort.field) ? "date" : "title"][sort.direction];

// "Added, newest first, by month", the sort button's tip: design 399p.
export const librarySortLabel = (sort: LibrarySort): string =>
  [LIBRARY_SORT_FIELD_LABEL[sort.field], libraryDirectionLabel(sort), GROUP_LABEL[sort.group]].filter(Boolean).join(", ");

// The three orders the sort pill offered, so old links and saved views read the same.
export const LIBRARY_SORT_PRESETS = ["newest", "oldest", "title"] as const;
export type LibrarySortPreset = (typeof LIBRARY_SORT_PRESETS)[number];

export const LIBRARY_SORT_PRESET: Record<LibrarySortPreset, LibrarySort> = {
  newest: DEFAULT_LIBRARY_SORT,
  oldest: { field: "added", direction: "asc", group: "none" },
  title: { field: "title", direction: "asc", group: "none" },
};
