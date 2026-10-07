import {
  DEFAULT_OVERVIEW_STATE,
  changedFields,
  foldFiling,
  foldOverviewState,
  rebasePendingChanges,
  type FoldableFiling,
  type FoldableState,
  type OutboxEntry,
  type OutboxFailure,
  type OutboxKind,
  type PendingWrite,
  type RecordChange,
  type StoredTranscript,
  type SyncStorage,
  type WriteAcknowledgement,
} from "@overview/domain";

const recordKey = (kind: OutboxKind, id: string) => `${kind}/${id}`;

export class InMemorySyncStorage implements SyncStorage {
  enrolled = false;
  cursorValue = 0;
  outbox: OutboxEntry[] = [];
  records = new Map<string, Record<string, unknown>>();
  revisions = new Map<string, number>();
  transcripts = new Map<string, StoredTranscript>();
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
    else if ("tombstoned" in outcome) this.revisions.delete(recordKey(entry.kind, entry.id));
  }

  async park(key: number, failure: OutboxFailure) {
    this.outbox = this.outbox.map((entry) => (entry.key === key ? { ...entry, stuck: failure } : entry));
  }

  async revisionOf(kind: OutboxKind, id: string) {
    return this.revisions.get(recordKey(kind, id)) ?? null;
  }

  // What IndexedDbSyncStorage does over its stores, over the maps here.
  async foldOverview(from: string, into: string) {
    const winner = this.records.get(recordKey("overview", into));
    if (winner === undefined) return null;
    const loser = this.records.get(recordKey("overview", from)) ?? {};
    const filing = filingOf(winner);
    const folded = foldFiling(filing, filingOf(loser));
    const changes = changedFields(filing, folded);
    this.records.set(recordKey("overview", into), { ...winner, ...folded });
    const at = new Date().toISOString();
    if (changes.topicIds) this.journal({ kind: "overview", id: into, updatedAt: at, change: { op: "topics", topicIds: changes.topicIds } });
    if (changes.tags) this.journal({ kind: "overview", id: into, updatedAt: at, change: { op: "tags", tags: changes.tags } });
    if (changes.captureReason !== undefined) {
      this.journal({ kind: "overview", id: into, updatedAt: at, change: { op: "captureReason", captureReason: changes.captureReason } });
    }
    const winnerState = stateOf(this.records.get(recordKey("overviewState", into)));
    const foldedState = foldOverviewState(winnerState, stateOf(this.records.get(recordKey("overviewState", from))));
    const patch = changedFields(winnerState, foldedState);
    if (Object.keys(patch).length > 0) {
      this.records.set(recordKey("overviewState", into), { ...foldedState, overviewId: into });
      this.journal({ kind: "overviewState", id: into, updatedAt: at, change: { op: "state", patch } });
    }
    this.records.delete(recordKey("overview", from));
    this.records.delete(recordKey("overviewState", from));
    this.outbox = this.outbox
      .filter((entry) => !((entry.kind === "overview" || entry.kind === "overviewState") && entry.id === from))
      .map((entry) =>
        entry.change.op === "transcript" && entry.change.overviewId === from
          ? { ...entry, change: { ...entry.change, overviewId: into } }
          : entry,
      );
    return { from, into };
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

  // Videos a note on this device uses; the tests that push a transcript add theirs.
  notedVideoIds = new Set<string>();

  async transcriptToPush(videoId: string) {
    return this.notedVideoIds.has(videoId) ? (this.transcripts.get(videoId) ?? null) : null;
  }

  async keepTranscript(transcript: StoredTranscript) {
    this.transcripts.set(transcript.videoId, transcript);
  }
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const filingOf = (record: Record<string, unknown>): FoldableFiling => ({
  topicIds: strings(record.topicIds),
  tags: strings(record.tags),
  captureReason: typeof record.captureReason === "string" ? record.captureReason : null,
});

const stateOf = (record: Record<string, unknown> | undefined): FoldableState => ({
  read: record?.read === true,
  favourite: record?.favourite === true,
  userTags: record === undefined ? [...DEFAULT_OVERVIEW_STATE.userTags] : strings(record.userTags),
});
