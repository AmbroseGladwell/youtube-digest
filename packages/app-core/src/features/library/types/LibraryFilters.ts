import type { Novelty, TopicId } from "@overview/types";

export interface LibraryFilters {
  topicId: TopicId | "all";
  novelty: Novelty | "all";
  status: "all" | "read" | "unread";
  favourite: boolean;
  dubious: boolean;
  query: string;
}

export const DEFAULT_LIBRARY_FILTERS: LibraryFilters = {
  topicId: "all",
  novelty: "all",
  status: "all",
  favourite: false,
  dubious: false,
  query: "",
};
