import type { Topic } from "@overview/domain";
import type { LibraryTopicFilter } from "../types/LibraryFilters.js";

export const TOPIC_LIMIT = 6;

export interface CappedTopics {
  shown: Topic[];
  hiddenCount: number;
}

export const cappedTopics = (topics: Topic[], selectedId: LibraryTopicFilter, limit: number = TOPIC_LIMIT): CappedTopics => {
  const shown = topics.slice(0, limit);
  const selected = topics.find((topic) => topic.id === selectedId);

  if (selected && !shown.includes(selected)) {
    shown.push(selected);
  }

  return { shown, hiddenCount: topics.length - shown.length };
};
