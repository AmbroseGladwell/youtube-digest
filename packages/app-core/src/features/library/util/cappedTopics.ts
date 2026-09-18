import type { Topic, TopicId } from "@overview/types";

export const TOPIC_LIMIT = 6;

export interface CappedTopics {
  shown: Topic[];
  hiddenCount: number;
}

export function cappedTopics(
  topics: Topic[],
  selectedId: TopicId | "all",
  limit: number = TOPIC_LIMIT,
): CappedTopics {
  const shown = topics.slice(0, limit);
  const selected = topics.find((topic) => topic.id === selectedId);

  if (selected && !shown.includes(selected)) {
    shown.push(selected);
  }

  return { shown, hiddenCount: topics.length - shown.length };
}
