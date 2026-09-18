import type { Overview, TopicId } from "@overview/types";

export const filedUnderTopic = (overview: Overview, topicId: TopicId): Overview =>
  overview.topicIds.includes(topicId)
    ? overview
    : { ...overview, topicIds: [...overview.topicIds, topicId] };

export const unfiledFromTopic = (overview: Overview, topicId: TopicId): Overview => ({
  ...overview,
  topicIds: overview.topicIds.filter((id) => id !== topicId),
});
