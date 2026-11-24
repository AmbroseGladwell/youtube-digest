import { NOVELTY_LABEL, type Topic } from "@overview/domain";
import { LIBRARY_ADDED_LABEL, LIBRARY_KIND_LABEL, type LibraryFilters } from "../types/LibraryFilters.js";
import type { LibrarySource } from "./librarySourceOf.js";
import { librarySourceName } from "./librarySourceName.js";

export interface AppliedLibraryFilter {
  key: string;
  label: string;
  clear: Partial<LibraryFilters>;
}

// One per value, so each can be taken off alone: docs/features/library-filters.md, "Chips".
export const appliedLibraryFilters = (
  filters: LibraryFilters,
  topics: Topic[],
  sources: readonly LibrarySource[] = [],
): AppliedLibraryFilter[] => {
  const applied: AppliedLibraryFilter[] = [];
  const without = <T>(values: T[], value: T): T[] => values.filter((candidate) => candidate !== value);

  for (const kind of filters.kinds) {
    applied.push({ key: `kind:${kind}`, label: LIBRARY_KIND_LABEL[kind], clear: { kinds: without(filters.kinds, kind) } });
  }
  for (const source of filters.sources) {
    applied.push({
      key: `source:${source}`,
      label: librarySourceName(source, sources),
      clear: { sources: without(filters.sources, source) },
    });
  }
  if (filters.added !== "any") {
    applied.push({ key: "added", label: LIBRARY_ADDED_LABEL[filters.added], clear: { added: "any" } });
  }
  if (filters.topicId !== "all") {
    const label = filters.topicId === "none" ? "No topic" : (topics.find((candidate) => candidate.id === filters.topicId)?.name ?? "Topic");
    applied.push({ key: "topic", label, clear: { topicId: "all" } });
  }
  for (const novelty of filters.novelties) {
    applied.push({ key: `verdict:${novelty}`, label: NOVELTY_LABEL[novelty], clear: { novelties: without(filters.novelties, novelty) } });
  }
  if (filters.status !== "all") {
    applied.push({
      key: "status",
      label: filters.status === "unread" ? "Unread" : "Read",
      clear: { status: "all" },
    });
  }
  if (filters.favourite) {
    applied.push({ key: "favourite", label: "Favourite", clear: { favourite: false } });
  }
  if (filters.dubious) {
    applied.push({ key: "dubious", label: "⚠ Dubious", clear: { dubious: false } });
  }
  for (const tag of filters.tags) {
    applied.push({ key: `tag:${tag}`, label: `#${tag}`, clear: { tags: without(filters.tags, tag) } });
  }
  if (filters.query.trim() !== "") {
    applied.push({ key: "query", label: `“${filters.query.trim()}”`, clear: { query: "" } });
  }

  return applied;
};
