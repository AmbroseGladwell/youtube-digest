import { sameTopicName, type Overview, type Topic, type TopicId } from "@overview/domain";

export interface TopicUsage {
  topic: Topic;
  count: number;
}

type Filed = Pick<Overview, "topicIds">;

export const overviewsText = (count: number) => `${count} ${count === 1 ? "overview" : "overviews"}`;

export const topicUsage = (topics: readonly Topic[], overviews: readonly Filed[]): TopicUsage[] =>
  topics
    .map((topic) => ({ topic, count: overviews.filter(({ topicIds }) => topicIds.includes(topic.id)).length }))
    .sort((left, right) => right.count - left.count || left.topic.name.localeCompare(right.topic.name));

export const filedUnderAny = (overviews: readonly Filed[], ids: readonly TopicId[]): number =>
  overviews.filter(({ topicIds }) => topicIds.some((id) => ids.includes(id))).length;

export const leftWithoutTopic = (overviews: readonly Filed[], ids: readonly TopicId[]): number =>
  overviews.filter(({ topicIds }) => topicIds.length > 0 && topicIds.every((id) => ids.includes(id))).length;

export type RenameCheck = { kind: "blank" } | { kind: "rename"; name: string } | { kind: "merge"; into: Topic };

export const renameCheck = (draft: string, topic: Topic, topics: readonly Topic[]): RenameCheck => {
  const name = draft.trim();
  if (name === "") {
    return { kind: "blank" };
  }
  const taken = topics.find((other) => other.id !== topic.id && sameTopicName(other.name, name));
  return taken === undefined ? { kind: "rename", name } : { kind: "merge", into: taken };
};

// The reader decides whether it still fits; code can only notice the name moved (docs/features/topic-filing.md).
export const descriptionNeedsLook = (topic: Topic, draftName: string, draftDescription: string): boolean =>
  topic.description !== null && draftName.trim() !== topic.name && draftDescription === topic.description;

export const descriptionOrNull = (draft: string): string | null => (draft.trim() === "" ? null : draft.trim());

export const descriptionChange = (topic: Topic, description: string | null): "changed" | "cleared" | "left" => {
  if (description === topic.description) {
    return "left";
  }
  return description === null ? "cleared" : "changed";
};

export interface MergeDefaults {
  keep: TopicId;
  description: string;
  from: Topic | null;
  others: Topic[];
}

export const mergeDefaults = (picked: readonly TopicUsage[], keep: TopicId = picked[0]!.topic.id): MergeDefaults => {
  const kept = picked.find(({ topic }) => topic.id === keep)!.topic;
  const described = [kept, ...picked.map(({ topic }) => topic).filter((topic) => topic.id !== keep)].filter(
    (topic) => topic.description !== null,
  );
  const from = described[0] ?? null;
  return { keep, description: from?.description ?? "", from, others: described.slice(1) };
};

export const borrowNote = ({ from, others }: MergeDefaults): string | null => {
  if (from === null || others.length === 0) {
    return null;
  }
  const had = others.map(({ name, description }) => `${name} had “${description}”${/[.!?]$/.test(description ?? "") ? "" : "."}`);
  return `From ${from.name}. ${had.join(" ")}`;
};

export type MergeTarget = { kind: "picked"; topic: Topic } | { kind: "existing"; topic: Topic } | { kind: "new"; name: string } | null;

export const mergeTarget = (keep: TopicId | "new", newName: string, picked: readonly Topic[], topics: readonly Topic[]): MergeTarget => {
  if (keep !== "new") {
    const topic = picked.find(({ id }) => id === keep);
    return topic === undefined ? null : { kind: "picked", topic };
  }
  const name = newName.trim();
  if (name === "") {
    return null;
  }
  const same = picked.find((topic) => sameTopicName(topic.name, name));
  if (same !== undefined) {
    return { kind: "picked", topic: same };
  }
  const existing = topics.find((topic) => sameTopicName(topic.name, name));
  return existing === undefined ? { kind: "new", name } : { kind: "existing", topic: existing };
};

export const mergeTargetName = (target: MergeTarget): string | null => {
  if (target === null) {
    return null;
  }
  return target.kind === "new" ? target.name : target.topic.name;
};

const listed = (names: readonly string[]): string =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

export interface DeleteCopy {
  title: string;
  names: string | null;
  body: string;
  button: string;
}

export const deleteCopy = (topics: readonly Topic[], overviews: number, unsorted: number): DeleteCopy => {
  const one = topics.length === 1;
  const keptLine = (subject: string) =>
    overviews === 0 ? "" : ` ${subject} in your library${unsorted === 0 ? "." : `; ${unsorted} will have no topic.`}`;
  return one
    ? {
        title: `Delete ${topics[0]!.name}?`,
        names: null,
        body: `It’s on ${overviewsText(overviews)}.${keptLine(overviews === 1 ? "It stays" : "They stay")}`,
        button: "Delete topic",
      }
    : {
        title: `Delete ${topics.length} topics?`,
        names: listed(topics.map(({ name }) => name)),
        body: `They’re on ${overviewsText(overviews)}.${keptLine(overviews === 1 ? "That stays" : "Those stay")}`,
        button: `Delete ${topics.length} topics`,
      };
};

export const deletedNotice = (topics: readonly Topic[], unsorted: number): string => {
  const what = topics.length === 1 ? topics[0]!.name : `${topics.length} topics`;
  if (unsorted === 0) {
    return `Deleted ${what}.`;
  }
  return `Deleted ${what}. ${overviewsText(unsorted)} ${unsorted === 1 ? "has" : "have"} no topic now.`;
};

export const mergedNotice = (topics: number, into: string, overviews: number) =>
  `Merged ${topics} topics into ${into}, now on ${overviewsText(overviews)}.`;

export const summaryLine = (topics: number, overviews: number) =>
  `${topics} ${topics === 1 ? "topic" : "topics"} on ${overviewsText(overviews)}. Changes apply to every overview filed under the topic.`;
