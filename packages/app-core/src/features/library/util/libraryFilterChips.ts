import { NOVELTY_LABEL, type Topic } from "@overview/domain";
import { LIBRARY_ADDED_LABEL, LIBRARY_KIND_LABEL, type LibraryFilters } from "../types/LibraryFilters.js";
import { DEFAULT_LIBRARY_VIEW } from "../types/LibraryView.js";
import type { LibrarySource } from "./librarySourceOf.js";
import { librarySourceName } from "./librarySourceName.js";

export const LIBRARY_CHIP_GROUPS = ["Show", "Added", "Kind", "Source", "Topic", "Tags", "Verdict"] as const;
export type LibraryChipGroup = (typeof LIBRARY_CHIP_GROUPS)[number];

export interface LibraryFilterChip {
  key: string;
  group: LibraryChipGroup;
  label: string;
  removeLabel: string;
  clear: Partial<LibraryFilters>;
}

const without = <T>(values: T[], value: T): T[] => values.filter((candidate) => candidate !== value);

// In the menu's group order, one per value: design 399o-10, 399o-17.
export const libraryFilterChips = (
  filters: LibraryFilters,
  topics: Topic[],
  defaults: LibraryFilters = DEFAULT_LIBRARY_VIEW.filters,
  sources: readonly LibrarySource[] = [],
): LibraryFilterChip[] => {
  const chips: LibraryFilterChip[] = [];
  const chip = (group: LibraryChipGroup, key: string, label: string, clear: Partial<LibraryFilters>, removeLabel = `Remove ${label}`) =>
    chips.push({ key, group, label, removeLabel, clear });

  if (filters.status !== defaults.status) {
    chip("Show", "status", { all: "Read and unread", read: "Read", unread: "Unread" }[filters.status], { status: defaults.status });
  }
  if (filters.favourite !== defaults.favourite) {
    chip("Show", "favourite", "Favourite", { favourite: defaults.favourite });
  }
  if (filters.withoutOverview !== defaults.withoutOverview) {
    chip("Show", "pending", "No overview yet", { withoutOverview: defaults.withoutOverview });
  }
  if (filters.added !== defaults.added && filters.added !== "any") {
    chip("Added", "added", LIBRARY_ADDED_LABEL[filters.added], { added: defaults.added });
  }
  for (const kind of filters.kinds) {
    chip("Kind", `kind:${kind}`, LIBRARY_KIND_LABEL[kind], { kinds: without(filters.kinds, kind) });
  }
  for (const source of filters.sources) {
    chip("Source", `source:${source}`, librarySourceName(source, sources), { sources: without(filters.sources, source) });
  }
  if (filters.topicId !== defaults.topicId) {
    const name = filters.topicId === "none" ? "No topic" : (topics.find((topic) => topic.id === filters.topicId)?.name ?? "Topic");
    chip("Topic", "topic", name, { topicId: defaults.topicId });
  }
  for (const tag of filters.tags) {
    chip("Tags", `tag:${tag}`, `#${tag}`, { tags: without(filters.tags, tag) });
  }
  for (const novelty of filters.novelties) {
    chip("Verdict", `verdict:${novelty}`, NOVELTY_LABEL[novelty], { novelties: without(filters.novelties, novelty) });
  }
  if (filters.dubious !== defaults.dubious) {
    chip("Verdict", "dubious", "Dubious", { dubious: defaults.dubious });
  }

  return chips;
};

// Clear under a group's label takes every value in it off at once.
export const clearGroupPatch = (
  group: LibraryChipGroup,
  defaults: LibraryFilters = DEFAULT_LIBRARY_VIEW.filters,
): Partial<LibraryFilters> => {
  switch (group) {
    case "Show":
      return { status: defaults.status, favourite: defaults.favourite, withoutOverview: defaults.withoutOverview };
    case "Added":
      return { added: defaults.added };
    case "Kind":
      return { kinds: defaults.kinds };
    case "Source":
      return { sources: defaults.sources };
    case "Topic":
      return { topicId: defaults.topicId };
    case "Tags":
      return { tags: defaults.tags };
    case "Verdict":
      return { novelties: defaults.novelties, dubious: defaults.dubious };
  }
};
