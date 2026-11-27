import { DEFAULT_SETTINGS, type Topic, type TopicId } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import type { ClientContext } from "../versions/ClientContext.js";
import { decideMerge } from "./decideMerge.js";
import { SETTINGS_RECORD_ID } from "./RecordKind.js";
import type { RecordsRepository, WriteOperation } from "./RecordsRepository.js";
import type { StoredRecord } from "./StoredRecord.js";
import { topicAliasesIn } from "./topicAliasesIn.js";
import type { WriteDecision } from "./WriteDecision.js";

export interface TopicRestore {
  topic: Topic;
  into: TopicId;
  refiled: readonly string[];
  added: readonly string[];
  updatedAt: string;
  client: ClientContext;
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const refiledBack = (current: StoredRecord | null, restore: TopicRestore, id: string): WriteDecision => {
  if (current === null || current.deleted) {
    return { action: "nothing" };
  }
  const giveBack = restore.refiled.includes(id);
  const takeAway = restore.added.includes(id);
  return decideMerge(
    "overview",
    current,
    {
      patch: {},
      updatedAt: restore.updatedAt,
      ifMatch: null,
      defaults: null,
      merge: (base) => {
        const held = strings(base.topicIds).filter((topicId) => !(takeAway && topicId === restore.into));
        return { ...base, topicIds: giveBack && !held.includes(restore.topic.id) ? [...held, restore.topic.id] : held };
      },
    },
    restore.client,
  );
};

const unaliased = (current: StoredRecord | null, { topic, updatedAt, client }: TopicRestore): WriteDecision =>
  decideMerge(
    "settings",
    current,
    {
      patch: {},
      updatedAt,
      ifMatch: null,
      defaults: { ...DEFAULT_SETTINGS },
      merge: (base) => {
        const { [topic.id]: _gone, ...topicAliases } = topicAliasesIn(base);
        return { ...base, topicAliases };
      },
    },
    client,
  );

// Undo of a merge: docs/features/topic-filing.md, "Undoing a merge".
export const restoreTopic = async (records: RecordsRepository, accountId: AccountId, restore: TopicRestore): Promise<void> => {
  const overviewIds = [...new Set([...restore.refiled, ...restore.added])];
  const operations: WriteOperation[] = [
    {
      kind: "topic",
      id: restore.topic.id,
      decide: (current) =>
        current !== null && !current.deleted
          ? { action: "nothing" }
          : decideMerge(
              "topic",
              null,
              { patch: {}, updatedAt: restore.updatedAt, ifMatch: null, defaults: { ...restore.topic } },
              restore.client,
            ),
    },
    { kind: "settings", id: SETTINGS_RECORD_ID, decide: (current) => unaliased(current, restore) },
    ...overviewIds.map((id): WriteOperation => ({ kind: "overview", id, decide: (current) => refiledBack(current, restore, id) })),
  ];
  await records.write(accountId, operations);
};
