import type { Novelty, TopicId } from "@overview/types";
import type { OverviewWithState } from "../../overviews/types/OverviewWithState.js";

export interface LibraryFilterCounts {
  total: number;
  unread: number;
  favourite: number;
  dubious: number;
  byTopic: Record<string, number>;
  byNovelty: Record<string, number>;
}

export function libraryFilterCounts(entries: OverviewWithState[]): LibraryFilterCounts {
  const byTopic: Record<string, number> = {};
  const byNovelty: Record<string, number> = {};
  let unread = 0;
  let favourite = 0;
  let dubious = 0;

  for (const { overview, state } of entries) {
    if (!state.read) unread += 1;
    if (state.favourite) favourite += 1;
    if (overview.verdict?.dubious) dubious += 1;
    for (const topicId of overview.topicIds as TopicId[]) {
      byTopic[topicId] = (byTopic[topicId] ?? 0) + 1;
    }
    const novelty: Novelty | undefined = overview.verdict?.novelty;
    if (novelty) byNovelty[novelty] = (byNovelty[novelty] ?? 0) + 1;
  }

  return { total: entries.length, unread, favourite, dubious, byTopic, byNovelty };
}
