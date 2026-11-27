import { z } from "zod";
import { TopicId } from "./Brands.js";

// null for a deleted topic; kept so a late write can't file under it again (docs/features/topic-filing.md).
export const TopicAliases = z.record(TopicId, TopicId.nullable());
export type TopicAliases = z.infer<typeof TopicAliases>;

export const resolveTopicIds = (topicIds: readonly string[], aliases: Readonly<Record<string, string | null>>): TopicId[] => {
  const resolved: TopicId[] = [];
  for (const id of topicIds) {
    const to = Object.hasOwn(aliases, id) ? aliases[id]! : id;
    if (to !== null && !resolved.includes(to as TopicId)) {
      resolved.push(to as TopicId);
    }
  }
  return resolved;
};

export const withTopicAlias = (aliases: Readonly<Record<string, string | null>>, from: TopicId, into: TopicId | null): TopicAliases => ({
  ...(Object.fromEntries(Object.entries(aliases).map(([alias, to]) => [alias, to === from ? into : to])) as TopicAliases),
  [from]: into,
});
