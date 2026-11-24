import type { Novelty, TopicId } from "@overview/domain";

export const LIBRARY_KINDS = ["video", "article", "podcast", "recipe"] as const;
export type LibraryKind = (typeof LIBRARY_KINDS)[number];

export const LIBRARY_KIND_LABEL: Record<LibraryKind, string> = {
  video: "Videos",
  article: "Articles",
  podcast: "Podcasts",
  recipe: "Recipes",
};

export const LIBRARY_ADDED = ["any", "today", "7d", "30d", "3m", "6m"] as const;
export type LibraryAdded = (typeof LIBRARY_ADDED)[number];

export const LIBRARY_ADDED_LABEL: Record<LibraryAdded, string> = {
  any: "Any time",
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "3m": "Last 3 months",
  "6m": "Last 6 months",
};

// A platform's name, or "site:" and the registrable domain: docs/features/library-filters.md, "Source".
export type LibrarySourceId = string & { readonly __brand: "LibrarySourceId" };

export type LibraryTopicFilter = TopicId | "all" | "none";

export interface LibraryFilters {
  kinds: LibraryKind[];
  sources: LibrarySourceId[];
  added: LibraryAdded;
  topicId: LibraryTopicFilter;
  novelties: Novelty[];
  status: "all" | "read" | "unread";
  favourite: boolean;
  // Show › No overview yet: docs/features/kept-links.md, "In the library".
  withoutOverview: boolean;
  dubious: boolean;
  tags: string[];
  query: string;
}

export const NO_LIBRARY_FILTERS: LibraryFilters = {
  kinds: [],
  sources: [],
  added: "any",
  topicId: "all",
  novelties: [],
  status: "all",
  favourite: false,
  withoutOverview: false,
  dubious: false,
  tags: [],
  query: "",
};
