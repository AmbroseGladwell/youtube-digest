import type { TranscriptMoment, TranscriptSearchResponse } from "@overview/domain";
import type { LibraryEntry } from "../../overviews/types/LibraryEntry.js";
import type { OverviewWithState } from "../../overviews/types/OverviewWithState.js";
import type { LibraryFilters } from "../types/LibraryFilters.js";
import { matchesLibraryFilters } from "./matchesLibraryFilters.js";

export const TRANSCRIPT_ROWS = 10;

export type SaidEntry = { kind: "overview" } & OverviewWithState & { moment: TranscriptMoment };

// Why they sit between word and meaning matches: docs/features/transcript-search.md, "In the library".
export const transcriptEntries = (
  entries: LibraryEntry[],
  filters: LibraryFilters,
  result: TranscriptSearchResponse | undefined,
  shownIds: ReadonlySet<string>,
): SaidEntry[] => {
  if (result === undefined || filters.query.trim() === "") {
    return [];
  }
  const withoutQuery = { ...filters, query: "" };
  const byId = new Map(
    entries.flatMap((entry) =>
      entry.kind === "overview" && matchesLibraryFilters(entry, withoutQuery) ? [[entry.overview.id as string, entry] as const] : [],
    ),
  );
  return result.matches
    .filter(({ overviewId }) => !shownIds.has(overviewId))
    .flatMap(({ overviewId, moments }) => {
      const entry = byId.get(overviewId);
      const [moment] = moments;
      return entry === undefined || moment === undefined ? [] : [{ ...entry, moment }];
    })
    .slice(0, TRANSCRIPT_ROWS);
};
