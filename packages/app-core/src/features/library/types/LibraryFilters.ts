import type { Novelty, TopicId } from "@overview/domain";

export const LIBRARY_SOURCES = ["video", "article", "recipe", "podcast"] as const;
export type LibrarySource = (typeof LIBRARY_SOURCES)[number];

export const LIBRARY_SOURCE_LABEL: Record<LibrarySource, string> = {
  video: "Videos",
  article: "Articles",
  recipe: "Recipes",
  podcast: "Podcasts",
};

export interface LibraryFilters {
  source: LibrarySource | "all";
  topicId: TopicId | "all";
  novelty: Novelty | "all";
  status: "all" | "read" | "unread";
  favourite: boolean;
  dubious: boolean;
  // One tag at a time; picking another swaps it ("OV-84 2 Library Filter" 84g).
  tag: string | null;
  query: string;
}

export const NO_LIBRARY_FILTERS: LibraryFilters = {
  source: "all",
  topicId: "all",
  novelty: "all",
  status: "all",
  favourite: false,
  dubious: false,
  tag: null,
  query: "",
};
