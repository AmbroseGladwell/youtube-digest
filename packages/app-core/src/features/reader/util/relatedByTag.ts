import type { OverviewWithState } from "../../overviews/types/OverviewWithState.js";
import { overviewTags } from "../../overviews/util/overviewTags.js";

export const RELATED_BY_TAG_LIMIT = 8;

export interface RelatedOverview extends OverviewWithState {
  sharedTags: number;
}

// The overviews that share the most tags with this one, newest first among equals
// ("OV-84 1 On the Note" 84a). Read ones stay in.
export function relatedByTag(
  current: OverviewWithState,
  library: readonly OverviewWithState[],
  limit: number = RELATED_BY_TAG_LIMIT,
): RelatedOverview[] {
  const tags = new Set(overviewTags(current));
  return library
    .filter(({ overview }) => overview.id !== current.overview.id)
    .map((entry) => ({ ...entry, sharedTags: overviewTags(entry).filter((tag) => tags.has(tag)).length }))
    .filter(({ sharedTags }) => sharedTags > 0)
    .sort(
      (left, right) =>
        right.sharedTags - left.sharedTags || right.overview.savedAt.localeCompare(left.overview.savedAt),
    )
    .slice(0, limit);
}
