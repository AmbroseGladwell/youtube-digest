import type { OverviewWithState } from "../types/OverviewWithState.js";

// Newest saved first. The library list and the reader's Previous/Next share this so the
// "4 of 31" the reader shows is the position in the list the reader was opened from.
export function orderOverviewsBySavedAt(entries: OverviewWithState[]): OverviewWithState[] {
  return [...entries].sort((a, b) => b.overview.savedAt.localeCompare(a.overview.savedAt));
}
