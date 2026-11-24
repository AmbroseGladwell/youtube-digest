import { NOVELTY_LABEL, type Topic } from "@overview/domain";
import { LIBRARY_ADDED_LABEL, LIBRARY_KIND_LABEL, type LibraryFilters } from "../types/LibraryFilters.js";
import { DEFAULT_LIBRARY_VIEW } from "../types/LibraryView.js";
import type { LibrarySource } from "./librarySourceOf.js";
import { librarySourceName } from "./librarySourceName.js";

export interface LibraryFilterChip {
  key: string;
  label: string;
  removeLabel: string;
  clear: Partial<LibraryFilters>;
}

const without = <T>(values: T[], value: T): T[] => values.filter((candidate) => candidate !== value);

export const libraryFilterChips = (
  filters: LibraryFilters,
  topics: Topic[],
  defaults: LibraryFilters = DEFAULT_LIBRARY_VIEW.filters,
  sources: readonly LibrarySource[] = [],
): LibraryFilterChip[] => {
  const chips: LibraryFilterChip[] = [];

  for (const tag of filters.tags) {
    chips.push({
      key: `tag:${tag}`,
      label: `#${tag}`,
      removeLabel: `Remove tag filter ${tag}`,
      clear: { tags: without(filters.tags, tag) },
    });
  }
  for (const kind of filters.kinds) {
    const label = LIBRARY_KIND_LABEL[kind];
    chips.push({ key: `kind:${kind}`, label, removeLabel: `Remove kind filter ${label}`, clear: { kinds: without(filters.kinds, kind) } });
  }
  for (const source of filters.sources) {
    const label = librarySourceName(source, sources);
    chips.push({
      key: `source:${source}`,
      label,
      removeLabel: `Remove source filter ${label}`,
      clear: { sources: without(filters.sources, source) },
    });
  }
  if (filters.added !== defaults.added && filters.added !== "any") {
    const label = LIBRARY_ADDED_LABEL[filters.added];
    chips.push({ key: "added", label, removeLabel: `Remove filter ${label}`, clear: { added: defaults.added } });
  }
  if (filters.topicId !== defaults.topicId) {
    const name = filters.topicId === "none" ? "No topic" : (topics.find((topic) => topic.id === filters.topicId)?.name ?? "Topic");
    chips.push({ key: "topic", label: name, removeLabel: `Remove topic filter ${name}`, clear: { topicId: defaults.topicId } });
  }
  for (const novelty of filters.novelties) {
    const label = NOVELTY_LABEL[novelty];
    chips.push({
      key: `verdict:${novelty}`,
      label,
      removeLabel: `Remove verdict filter ${label}`,
      clear: { novelties: without(filters.novelties, novelty) },
    });
  }
  if (filters.dubious !== defaults.dubious) {
    chips.push({ key: "dubious", label: "Dubious only", removeLabel: "Remove filter Dubious only", clear: { dubious: defaults.dubious } });
  }
  if (filters.favourite !== defaults.favourite) {
    chips.push({
      key: "favourite",
      label: "Favourite",
      removeLabel: "Remove filter Favourite",
      clear: { favourite: defaults.favourite },
    });
  }
  if (filters.status !== defaults.status) {
    const label = { all: "Read and unread", read: "Read", unread: "Unread" }[filters.status];
    chips.push({ key: "status", label, removeLabel: `Remove filter ${label}`, clear: { status: defaults.status } });
  }

  return chips;
};
