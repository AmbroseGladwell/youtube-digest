import {
  editedTopic,
  refiledOnMerge,
  refiledOnRestore,
  resolveTopicIds,
  type OverviewId,
  type Topic,
  type TopicId,
  type TopicMerge,
  type TopicPatch,
} from "@overview/domain";

export type TopicChange =
  | { kind: "edit"; id: TopicId; patch: TopicPatch }
  | { kind: "merge"; from: TopicId[]; into: TopicId; patch: TopicPatch | null }
  | { kind: "undoMerge"; merges: TopicMerge[]; into: TopicId; restore: TopicPatch | null }
  | { kind: "delete"; ids: TopicId[] };

export const topicsAfter = (topics: readonly Topic[], change: TopicChange): Topic[] => {
  switch (change.kind) {
    case "edit":
      return topics.map((topic) => (topic.id === change.id ? editedTopic(topic, change.patch) : topic));
    case "merge":
      return topics
        .filter((topic) => !change.from.includes(topic.id))
        .map((topic) => (topic.id === change.into && change.patch !== null ? editedTopic(topic, change.patch) : topic));
    case "undoMerge": {
      const kept = topics.map((topic) =>
        topic.id === change.into && change.restore !== null ? editedTopic(topic, change.restore) : topic,
      );
      const back = change.merges.map(({ topic }) => topic).filter((topic) => !kept.some(({ id }) => id === topic.id));
      return [...kept, ...back];
    }
    case "delete":
      return topics.filter((topic) => !change.ids.includes(topic.id));
  }
};

export const topicIdsAfter = (id: OverviewId, topicIds: readonly TopicId[], change: TopicChange): TopicId[] => {
  switch (change.kind) {
    case "edit":
      return [...topicIds];
    case "merge":
      return resolveTopicIds(topicIds, Object.fromEntries(change.from.map((from) => [from, change.into])));
    case "undoMerge":
      return [...change.merges]
        .reverse()
        .reduce<TopicId[]>((held, merge) => refiledOnRestore([{ id, topicIds: held }], merge)[0]?.topicIds ?? held, [...topicIds]);
    case "delete":
      return change.ids.reduce<TopicId[]>(
        (held, gone) => refiledOnMerge([{ id, topicIds: held }], gone, null)[0]?.topicIds ?? held,
        [...topicIds],
      );
  }
};
