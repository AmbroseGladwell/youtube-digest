import type { MeaningSearchResponse } from "@overview/domain";
import type { LibraryEntry } from "../../overviews/types/LibraryEntry.js";
import type { OverviewWithState } from "../../overviews/types/OverviewWithState.js";
import type { LibraryFilters } from "../types/LibraryFilters.js";
import { matchesLibraryFilters } from "./matchesLibraryFilters.js";

export const MEANING_RESULTS = 5;

// After the word matches, the closest few that no word found, each still inside the other
// filters (docs/features/search-by-meaning.md, "Word and meaning together").
export function meaningEntries(
  entries: LibraryEntry[],
  filters: LibraryFilters,
  result: MeaningSearchResponse | undefined,
  shownIds: ReadonlySet<string>,
): Array<{ kind: "overview" } & OverviewWithState> {
  if (result === undefined || !result.available || filters.query.trim() === "") {
    return [];
  }
  const withoutQuery = { ...filters, query: "" };
  const byId = new Map(
    entries.flatMap((entry) => (entry.kind === "overview" && matchesLibraryFilters(entry, withoutQuery) ? [[entry.overview.id as string, entry] as const] : [])),
  );
  return result.matches
    .filter(({ overviewId }) => !shownIds.has(overviewId))
    .flatMap(({ overviewId }) => byId.get(overviewId) ?? [])
    .slice(0, MEANING_RESULTS);
}
