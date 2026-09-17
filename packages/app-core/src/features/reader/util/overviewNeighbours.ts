import type { OverviewId } from "@overview/types";
import type { OverviewWithState } from "../../overviews/types/OverviewWithState.js";

export interface OverviewNeighbours {
  position: number | null;
  total: number;
  previousId: OverviewId | null;
  nextId: OverviewId | null;
}

export function overviewNeighbours(
  ordered: OverviewWithState[],
  overviewId: OverviewId,
): OverviewNeighbours {
  const index = ordered.findIndex((entry) => entry.overview.id === overviewId);
  if (index === -1) {
    return { position: null, total: ordered.length, previousId: null, nextId: null };
  }
  return {
    position: index + 1,
    total: ordered.length,
    previousId: ordered[index - 1]?.overview.id ?? null,
    nextId: ordered[index + 1]?.overview.id ?? null,
  };
}
