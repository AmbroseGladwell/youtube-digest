import type { LibraryEntry } from "../../overviews/types/LibraryEntry.js";
import type { LibraryFilters } from "../types/LibraryFilters.js";
import { buildSearchHaystack } from "./buildSearchHaystack.js";

// Read and favourite are answerable for an unreadable record, because they live in their
// own store. Everything else reads a field of the overview, so including it would pollute
// every filtered view — it is excluded, and the exclusion is stated beside the count
// (docs/features/record-migrations.md).
export function matchesLibraryFilters(entry: LibraryEntry, filters: LibraryFilters): boolean {
  const { state } = entry;

  if (filters.status === "read" && !state.read) return false;
  if (filters.status === "unread" && state.read) return false;
  if (filters.favourite && !state.favourite) return false;

  const query = filters.query.trim().toLowerCase();

  if (entry.kind === "unreadable") {
    return filters.topicId === "all" && filters.novelty === "all" && !filters.dubious && !query;
  }

  const { overview } = entry;
  if (filters.topicId !== "all" && !overview.topicIds.includes(filters.topicId)) return false;
  if (filters.novelty !== "all" && overview.verdict?.novelty !== filters.novelty) return false;
  if (filters.dubious && !overview.verdict?.dubious) return false;
  if (query && !buildSearchHaystack(overview).includes(query)) return false;

  return true;
}
