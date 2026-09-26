import { mergeSettingsRecord } from "./mergeSettingsRecord.js";
import type { OutboxEntry } from "./OutboxEntry.js";
import { stampUpdatedAt } from "./storedUpdatedAt.js";

// A record pulled from the feed while this device still has unpushed writes to it: the
// local writes go back on top, in order, so the library never shows an edit as undone
// between the pull and the push that will carry it. Null means a pending delete, which
// the pull must not resurrect (docs/features/sync-client.md).
export function rebasePendingChanges(
  remote: Record<string, unknown>,
  pending: readonly OutboxEntry[],
): Record<string, unknown> | null {
  let record: Record<string, unknown> | null = remote;
  for (const entry of pending) {
    if (record === null) {
      break;
    }
    const applied = apply(record, entry);
    record = applied === null ? null : stampUpdatedAt(applied, new Date(entry.updatedAt));
  }
  return record;
}

function apply(record: Record<string, unknown>, entry: OutboxEntry): Record<string, unknown> | null {
  const { change } = entry;
  switch (change.op) {
    case "replace":
      return { ...change.record };
    case "topics":
      return { ...record, topicIds: change.topicIds };
    case "captureReason":
      return { ...record, captureReason: change.captureReason };
    case "state":
      return { ...record, ...change.patch };
    case "settings":
      return mergeSettingsRecord(record, change.patch);
    case "delete":
      return null;
  }
}
