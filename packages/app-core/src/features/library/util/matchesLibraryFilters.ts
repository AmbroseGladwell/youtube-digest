import type { OverviewWithState } from "../../overviews/types/OverviewWithState.js";
import type { LibraryFilters } from "../types/LibraryFilters.js";
import { buildSearchHaystack } from "./buildSearchHaystack.js";

export function matchesLibraryFilters(entry: OverviewWithState, filters: LibraryFilters): boolean {
  const { overview, state } = entry;

  if (filters.topicId !== "all" && !overview.topicIds.includes(filters.topicId)) return false;
  if (filters.novelty !== "all" && overview.verdict?.novelty !== filters.novelty) return false;
  if (filters.status === "read" && !state.read) return false;
  if (filters.status === "unread" && state.read) return false;
  if (filters.favourite && !state.favourite) return false;
  if (filters.dubious && !overview.verdict?.dubious) return false;

  const query = filters.query.trim().toLowerCase();
  if (query && !buildSearchHaystack(overview).includes(query)) return false;

  return true;
}
