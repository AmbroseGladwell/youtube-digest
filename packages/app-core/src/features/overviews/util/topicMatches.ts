import { sameTopicName, type Topic } from "@overview/domain";

export interface TopicMatch {
  topic: Topic;
  before: string;
  matched: string;
  after: string;
}

export function topicMatches(topics: Topic[], query: string): TopicMatch[] {
  const needle = query.trim().toLocaleLowerCase();
  if (needle === "") {
    return topics.map((topic) => ({ topic, before: topic.name, matched: "", after: "" }));
  }

  return topics.flatMap((topic) => {
    const at = topic.name.toLocaleLowerCase().indexOf(needle);
    if (at === -1) {
      return [];
    }
    return [
      {
        topic,
        before: topic.name.slice(0, at),
        matched: topic.name.slice(at, at + needle.length),
        after: topic.name.slice(at + needle.length),
      },
    ];
  });
}

export function creatableTopicName(topics: Topic[], query: string): string | null {
  const name = query.trim();
  if (name === "") {
    return null;
  }
  return topics.some((topic) => sameTopicName(topic.name, name)) ? null : name;
}
