import type { OverviewState, UnreadableRecord } from "@overview/domain";
import type { OverviewWithState } from "./OverviewWithState.js";

// An unreadable record is still the reader's own note, so it stays where they left it.
export type LibraryEntry =
  | ({ kind: "overview" } & OverviewWithState)
  | { kind: "unreadable"; record: UnreadableRecord; state: OverviewState };

export const libraryEntryId = (entry: LibraryEntry): string => (entry.kind === "overview" ? entry.overview.id : entry.record.id);

export const libraryEntrySavedAt = (entry: LibraryEntry): string | null =>
  entry.kind === "overview" ? entry.overview.savedAt : (entry.record.salvaged?.savedAt ?? null);

export const readableEntries = (entries: LibraryEntry[]): OverviewWithState[] => entries.filter((entry) => entry.kind === "overview");

export const libraryEntryTitle = (entry: LibraryEntry): string | null =>
  entry.kind === "overview" ? entry.overview.source.title : (entry.record.salvaged?.source?.title ?? null);
