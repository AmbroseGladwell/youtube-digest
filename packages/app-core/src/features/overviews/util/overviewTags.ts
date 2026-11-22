import type { OverviewWithState } from "../types/OverviewWithState.js";

export const overviewTags = ({ overview, state }: OverviewWithState): string[] => {
  return [...new Set([...overview.tags, ...state.userTags])];
};
