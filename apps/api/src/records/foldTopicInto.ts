import { DEFAULT_SETTINGS, mergeSettingsRecord, resolveTopicIds, withTopicAlias, type TopicId } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import type { ClientContext } from "../versions/ClientContext.js";
import { decideMerge } from "./decideMerge.js";
import { SETTINGS_RECORD_ID } from "./RecordKind.js";
import type { RecordsRepository, WriteOperation } from "./RecordsRepository.js";
import type { StoredRecord } from "./StoredRecord.js";
import { topicAliasesIn } from "./topicAliasesIn.js";
import type { WriteDecision } from "./WriteDecision.js";

export interface TopicFold {
  from: TopicId;
  into: TopicId | null;
  updatedAt: string;
  client: ClientContext;
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const refiled = (current: StoredRecord | null, { from, into, updatedAt, client }: TopicFold): WriteDecision => {
  if (current === null || current.deleted || !strings(current.body?.topicIds).includes(from)) {
    return { action: "nothing" };
  }
  return decideMerge(
    "overview",
    current,
    {
      patch: {},
      updatedAt,
      ifMatch: null,
      defaults: null,
      merge: (base) => ({ ...base, topicIds: resolveTopicIds(strings(base.topicIds), { [from]: into }) }),
    },
    client,
  );
};

const aliased = (current: StoredRecord | null, { from, into, updatedAt, client }: TopicFold): WriteDecision =>
  decideMerge(
    "settings",
    current,
    {
      patch: {},
      updatedAt,
      ifMatch: null,
      defaults: { ...DEFAULT_SETTINGS },
      merge: (base) => mergeSettingsRecord(base, { topicAliases: withTopicAlias(topicAliasesIn(base), from, into) }),
    },
    client,
  );

// Why the alias outlives the topic: docs/features/topic-filing.md, "Aliases".
export const foldTopicInto = async (records: RecordsRepository, accountId: AccountId, fold: TopicFold): Promise<number> => {
  const topic = await records.read(accountId, "topic", fold.from);
  if (topic === null || topic.deleted) {
    return 0;
  }
  const filed = await records.liveOverviewIdsFiledUnder(accountId, fold.from);
  const operations: WriteOperation[] = [
    ...filed.map((id): WriteOperation => ({ kind: "overview", id, decide: (current) => refiled(current, fold) })),
    { kind: "settings", id: SETTINGS_RECORD_ID, decide: (current) => aliased(current, fold) },
    {
      kind: "topic",
      id: fold.from,
      decide: (current) => (current === null || current.deleted ? { action: "nothing" } : { action: "tombstone" }),
    },
  ];
  const outcomes = await records.write(accountId, operations);
  return outcomes.slice(0, filed.length).filter((outcome) => outcome !== null).length;
};
