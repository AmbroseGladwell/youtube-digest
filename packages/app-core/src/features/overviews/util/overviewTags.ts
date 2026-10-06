import type { OverviewWithState } from "../types/OverviewWithState.js";

// The note's own tags and the ones the reader added, shown and matched as one list
// (docs/features/overview-generation-decisions.md, "users can add their own tags").
export function overviewTags({ overview, state }: OverviewWithState): string[] {
  return [...new Set([...overview.tags, ...state.userTags])];
}
