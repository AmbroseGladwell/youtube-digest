import type { TranscriptMoment, TranscriptSearchResponse } from "@overview/domain";
import type { LibraryEntry } from "../../overviews/types/LibraryEntry.js";
import type { LibraryFilters } from "../types/LibraryFilters.js";
import { matchesLibraryFilters } from "./matchesLibraryFilters.js";

export const TRANSCRIPT_ROWS = 10;

type SearchableEntry = Extract<LibraryEntry, { kind: "overview" | "capture" }>;

export type SaidEntry = SearchableEntry & { moment: TranscriptMoment };

const isSearchable = (entry: LibraryEntry): entry is SearchableEntry => entry.kind !== "unreadable";

const searchableId = (entry: SearchableEntry): string => (entry.kind === "overview" ? entry.overview.id : entry.capture.id);

export const saidSourceWord = (entry: SaidEntry): "video" | "episode" =>
  (entry.kind === "overview" ? entry.overview.source : entry.capture.source).kind === "podcast" ? "episode" : "video";

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
    entries
      .filter(isSearchable)
      .filter((entry) => matchesLibraryFilters(entry, withoutQuery))
      .map((entry) => [searchableId(entry), entry] as const),
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
