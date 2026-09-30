import { buildSearchHaystack, type TopicId } from "@overview/domain";
import type { LibraryEntry } from "./Library.js";
import type { LibraryFilters } from "./LibraryFilters.js";

export type ResolvedFilters = Omit<LibraryFilters, "topic"> & { topicId?: TopicId };

const words = (query: string) => query.toLowerCase().split(/\s+/).filter((word) => word !== "");

// The library's own haystack, so a search here finds what the library's search finds, but
// every word rather than the whole phrase: an assistant sends keywords, not a phrase it saw.
export function searchLibrary(entries: LibraryEntry[], filters: ResolvedFilters): LibraryEntry[] {
  const wanted = words(filters.query ?? "");
  const tag = filters.tag?.trim().toLowerCase();

  return entries.filter(({ overview, state }) => {
    if (filters.topicId !== undefined && !overview.topicIds.includes(filters.topicId)) return false;
    if (tag !== undefined && !overview.tags.includes(tag) && !(state?.userTags ?? []).includes(tag)) return false;
    if (filters.verdict !== undefined && overview.verdict?.novelty !== filters.verdict) return false;
    if (filters.dubious !== undefined && (overview.verdict?.dubious ?? false) !== filters.dubious) return false;
    if (filters.favourite !== undefined && (state?.favourite ?? false) !== filters.favourite) return false;
    if (filters.read !== undefined && (state?.read ?? false) !== filters.read) return false;
    const savedOn = overview.savedAt.slice(0, 10);
    if (filters.savedFrom !== undefined && savedOn < filters.savedFrom) return false;
    if (filters.savedTo !== undefined && savedOn > filters.savedTo) return false;
    if (wanted.length > 0) {
      const haystack = buildSearchHaystack(overview);
      if (!wanted.every((word) => haystack.includes(word))) return false;
    }
    return true;
  });
}
