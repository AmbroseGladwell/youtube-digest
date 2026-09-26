import {
  rebasePendingChanges,
  type OutboxEntry,
  type OutboxFailure,
  type PendingWrite,
  type RecordChange,
  type SyncStorage,
  type SyncedRecordKind,
  type WriteAcknowledgement,
} from "@overview/domain";

const recordKey = (kind: SyncedRecordKind, id: string) => `${kind}/${id}`;

export class InMemorySyncStorage implements SyncStorage {
  enrolled = false;
  cursorValue = 0;
  outbox: OutboxEntry[] = [];
  records = new Map<string, Record<string, unknown>>();
  revisions = new Map<string, number>();
  applied: RecordChange[][] = [];
  #nextKey = 1;
  #listeners = new Set<() => void>();
  // What enrol() would find in the library, for the tests that start with one.
  libraryOnEnrol: PendingWrite[] = [];

  journal(write: PendingWrite): OutboxEntry {
    const entry = { ...write, key: this.#nextKey++, stuck: null };
    this.outbox.push(entry);
    for (const listener of this.#listeners) listener();
    return entry;
  }

  async isEnrolled() {
    return this.enrolled;
  }

  async enrol() {
    if (this.enrolled) return;
    for (const write of this.libraryOnEnrol) this.outbox.push({ ...write, key: this.#nextKey++, stuck: null });
    this.enrolled = true;
  }

  async leave() {
    this.enrolled = false;
    this.cursorValue = 0;
    this.outbox = [];
    this.revisions.clear();
  }

  async cursor() {
    return this.cursorValue;
  }

  async listPending() {
    return [...this.outbox];
  }

  async acknowledge(key: number, outcome: WriteAcknowledgement) {
    const entry = this.outbox.find((candidate) => candidate.key === key);
    this.outbox = this.outbox.filter((candidate) => candidate.key !== key);
    if (!entry) return;
    if ("rev" in outcome) this.revisions.set(recordKey(entry.kind, entry.id), outcome.rev);
    else this.revisions.delete(recordKey(entry.kind, entry.id));
  }

  async park(key: number, failure: OutboxFailure) {
    this.outbox = this.outbox.map((entry) => (entry.key === key ? { ...entry, stuck: failure } : entry));
  }

  async revisionOf(kind: SyncedRecordKind, id: string) {
    return this.revisions.get(recordKey(kind, id)) ?? null;
  }

  async applyChanges(changes: RecordChange[], next: number) {
    for (const change of changes) {
      const key = recordKey(change.kind, change.id);
      if (change.deleted || change.body === undefined) {
        this.records.delete(key);
        this.revisions.delete(key);
        continue;
      }
      const pending = this.outbox.filter(
        (entry) => entry.stuck === null && entry.kind === change.kind && entry.id === change.id,
      );
      const rebased = rebasePendingChanges(
        { ...change.body, schemaVersion: change.schemaVersion, updatedAt: change.updatedAt },
        pending,
      );
      if (rebased === null) this.records.delete(key);
      else this.records.set(key, rebased);
      this.revisions.set(key, change.rev);
    }
    this.cursorValue = next;
    this.applied.push(changes);
  }

  onJournaled(listener: () => void) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
}
