import type { Novelty, TopicId } from "@overview/domain";

export interface LibraryFilters {
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
  topicId: "all",
  novelty: "all",
  status: "all",
  favourite: false,
  dubious: false,
  tag: null,
  query: "",
};
