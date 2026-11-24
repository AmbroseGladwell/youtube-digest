import type { OverviewState, SavedCapture, UnreadableRecord } from "@overview/domain";
import type { OverviewWithState } from "./OverviewWithState.js";

// An unreadable record is still the reader's own note, so it stays where they left it.
export type LibraryEntry =
  | ({ kind: "overview" } & OverviewWithState)
  | { kind: "unreadable"; record: UnreadableRecord; state: OverviewState }
  // Saved without its overview: docs/features/kept-links.md, "In the library".
  | { kind: "capture"; capture: SavedCapture; state: OverviewState };

export const libraryEntryId = (entry: LibraryEntry): string => {
  switch (entry.kind) {
    case "overview":
      return entry.overview.id;
    case "capture":
      return entry.capture.id;
    case "unreadable":
      return entry.record.id;
  }
};

export const libraryEntrySavedAt = (entry: LibraryEntry): string | null => {
  switch (entry.kind) {
    case "overview":
      return entry.overview.savedAt;
    case "capture":
      return entry.capture.savedAt;
    case "unreadable":
      return entry.record.salvaged?.savedAt ?? null;
  }
};

export const readableEntries = (entries: LibraryEntry[]): OverviewWithState[] => entries.filter((entry) => entry.kind === "overview");

export const libraryEntryTitle = (entry: LibraryEntry): string | null => {
  switch (entry.kind) {
    case "overview":
      return entry.overview.source.title;
    case "capture":
      return entry.capture.source.title;
    case "unreadable":
      return entry.record.salvaged?.source?.title ?? null;
  }
};
