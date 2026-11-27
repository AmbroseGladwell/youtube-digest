import type { OverviewId, TopicId } from "./Brands.js";
import type { Topic } from "./Topic.js";
import { resolveTopicIds } from "./TopicAliases.js";

// What Undo needs to put a merged topic back: docs/features/topic-filing.md, "Undoing a merge".
export interface TopicMerge {
  topic: Topic;
  into: TopicId;
  refiled: OverviewId[];
  added: OverviewId[];
}

export interface TopicsFiled {
  id: OverviewId;
  topicIds: readonly string[];
}

export interface Refiling {
  id: OverviewId;
  topicIds: TopicId[];
}

export const refiledOnMerge = (overviews: readonly TopicsFiled[], from: TopicId, into: TopicId | null): Refiling[] =>
  overviews
    .filter(({ topicIds }) => topicIds.includes(from))
    .map(({ id, topicIds }) => ({ id, topicIds: resolveTopicIds(topicIds, { [from]: into }) }));

export const addedOnMerge = (overviews: readonly TopicsFiled[], from: TopicId, into: TopicId): OverviewId[] =>
  overviews.filter(({ topicIds }) => topicIds.includes(from) && !topicIds.includes(into)).map(({ id }) => id);

export const refiledOnRestore = (overviews: readonly TopicsFiled[], merge: TopicMerge): Refiling[] =>
  overviews
    .filter(({ id }) => merge.refiled.includes(id) || merge.added.includes(id))
    .map(({ id, topicIds }) => {
      const held = topicIds.filter((topicId) => !(merge.added.includes(id) && topicId === merge.into)) as TopicId[];
      return { id, topicIds: merge.refiled.includes(id) && !held.includes(merge.topic.id) ? [...held, merge.topic.id] : held };
    });

export const restoreRequestOf = ({ topic, into, refiled, added }: TopicMerge): Record<string, unknown> => ({
  name: topic.name,
  description: topic.description,
  createdAt: topic.createdAt,
  into,
  refiled,
  added,
});
