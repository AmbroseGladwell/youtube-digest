import type { TopicId } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import type { ClientContext } from "../versions/ClientContext.js";
import { decideMerge } from "./decideMerge.js";
import { foldTopicInto } from "./foldTopicInto.js";
import type { RecordsRepository } from "./RecordsRepository.js";
import type { StoredRecord } from "./StoredRecord.js";

export interface TopicNameFold {
  kept: TopicId;
  folded: TopicId[];
  refiled: number;
}

interface LiveTopic {
  record: StoredRecord;
  key: string;
  createdAt: string;
  description: string | null;
}

const liveTopic = (record: StoredRecord): LiveTopic | null => {
  const name = record.body?.name;
  if (typeof name !== "string") {
    return null;
  }
  const description = record.body?.description;
  return {
    record,
    key: name.trim().toLocaleLowerCase(),
    createdAt: typeof record.body?.createdAt === "string" ? record.body.createdAt : "",
    description: typeof description === "string" && description.trim() !== "" ? description : null,
  };
};

const earliestFirst = (left: LiveTopic, right: LiveTopic): number =>
  left.createdAt.localeCompare(right.createdAt) || left.record.seq - right.record.seq;

// Why the server folds them: docs/features/topic-filing.md, "Same-name topics fold on the server".
export const foldSameNameTopics = async (
  records: RecordsRepository,
  accountId: AccountId,
  updatedAt: string,
  client: ClientContext,
): Promise<TopicNameFold[]> => {
  const topics = (await records.listLive(accountId, "topic", "%")).map(liveTopic).filter((topic) => topic !== null);
  const byName = new Map<string, LiveTopic[]>();
  for (const topic of topics) {
    byName.set(topic.key, [...(byName.get(topic.key) ?? []), topic]);
  }
  const folds: TopicNameFold[] = [];
  for (const group of byName.values()) {
    if (group.length < 2) {
      continue;
    }
    const [kept, ...losers] = group.sort(earliestFirst) as [LiveTopic, ...LiveTopic[]];
    const keptId = kept.record.id as TopicId;
    const description = kept.description ?? losers.find((loser) => loser.description !== null)?.description ?? null;
    if (description !== kept.description) {
      await records.write(accountId, [
        {
          kind: "topic",
          id: keptId,
          decide: (current) => decideMerge("topic", current, { patch: { description }, updatedAt, ifMatch: null, defaults: null }, client),
        },
      ]);
    }
    let refiled = 0;
    for (const loser of losers) {
      refiled += await foldTopicInto(records, accountId, { from: loser.record.id as TopicId, into: keptId, updatedAt, client });
    }
    folds.push({ kept: keptId, folded: losers.map((loser) => loser.record.id as TopicId), refiled });
  }
  return folds;
};
