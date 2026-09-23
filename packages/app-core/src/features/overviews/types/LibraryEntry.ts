import type { OverviewState, UnreadableRecord } from "@overview/domain";
import type { OverviewWithState } from "./OverviewWithState.js";

// A record the library holds, readable or not. An unreadable one is still one of the
// reader's own notes and still sits where they left it, so it travels with the readable
// ones rather than in a list of its own (docs/features/record-migrations.md).
export type LibraryEntry =
  | ({ kind: "overview" } & OverviewWithState)
  | { kind: "unreadable"; record: UnreadableRecord; state: OverviewState };

export const libraryEntryId = (entry: LibraryEntry): string =>
  entry.kind === "overview" ? entry.overview.id : entry.record.id;

export const libraryEntrySavedAt = (entry: LibraryEntry): string | null =>
  entry.kind === "overview" ? entry.overview.savedAt : (entry.record.salvaged?.savedAt ?? null);

export const readableEntries = (entries: LibraryEntry[]): OverviewWithState[] =>
  entries.filter((entry) => entry.kind === "overview");
