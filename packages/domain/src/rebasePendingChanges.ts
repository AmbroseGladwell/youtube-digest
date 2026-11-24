import { mergeSettingsRecord } from "./mergeSettingsRecord.js";
import { mergeProjectMember } from "./ProjectMember.js";
import { mergeSuggestedQuestion } from "./SuggestedQuestion.js";
import type { OutboxEntry } from "./OutboxEntry.js";
import { stampUpdatedAt } from "./storedUpdatedAt.js";

// Local writes go back on top; null is a pending delete not to resurrect (docs/features/sync-client.md).
export const rebasePendingChanges = (remote: Record<string, unknown>, pending: readonly OutboxEntry[]): Record<string, unknown> | null => {
  let record: Record<string, unknown> | null = remote;
  for (const entry of pending) {
    if (record === null) {
      break;
    }
    const applied = apply(record, entry);
    record = applied === null ? null : stampUpdatedAt(applied, new Date(entry.updatedAt));
  }
  return record;
};

const editedAt = (change: { edited?: true }, entry: OutboxEntry): { editedAt?: string } =>
  change.edited ? { editedAt: entry.updatedAt } : {};

const apply = (record: Record<string, unknown>, entry: OutboxEntry): Record<string, unknown> | null => {
  const { change } = entry;
  switch (change.op) {
    case "replace":
      return { ...change.record };
    case "topics":
      return { ...record, topicIds: change.topicIds, ...editedAt(change, entry) };
    case "captureReason":
      return { ...record, captureReason: change.captureReason, ...editedAt(change, entry) };
    case "tags":
      return { ...record, tags: change.tags, ...editedAt(change, entry) };
    case "state":
      return { ...record, ...change.patch };
    case "settings":
      return mergeSettingsRecord(record, change.patch);
    case "project":
      return { ...record, ...change.patch };
    case "member":
      return mergeProjectMember(record, change.change);
    case "suggestedQuestion":
      return mergeSuggestedQuestion(record, change.change);
    case "delete":
      return null;
    case "transcript":
      return record;
  }
};
