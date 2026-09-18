import type { Overview } from "@overview/types";

export function topicCounts(overviews: Overview[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const overview of overviews) {
    for (const topicId of overview.topicIds) {
      counts[topicId] = (counts[topicId] ?? 0) + 1;
    }
  }
  return counts;
}

export const unsortedOverviews = (overviews: Overview[]): Overview[] =>
  overviews.filter((overview) => overview.topicIds.length === 0);
