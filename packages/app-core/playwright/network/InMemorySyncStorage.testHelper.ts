import {
  Overview,
  OverviewState,
  Settings,
  Topic,
  type OutboxEntry,
  type OutboxFailure,
  type OutboxKind,
  type RecordChange,
  type StoredTranscript,
  type SyncStorage,
  type WriteAcknowledgement,
} from "@overview/domain";
import type { InMemoryOverviewStore } from "./InMemoryOverviewStore.testHelper.js";
import type { InMemorySettingsStore } from "./InMemorySettingsStore.testHelper.js";
import type { InMemoryTranscriptStore } from "./InMemoryTranscriptStore.testHelper.js";

// The browser-side sync bookkeeping for an IWFT run: what the feed delivers is written into
// the in-memory stores the app is reading, so a pulled record shows up where the reader
// would see it. Nothing here journals; pushing is covered where a real database and a real
// API exist (apps/api/src/sync/twoDevices.test.ts).
export class InMemorySyncStorage implements SyncStorage {
  enrolled = false;
  cursorValue = 0;
  outbox: OutboxEntry[] = [];
  applied: RecordChange[][] = [];
  revisions = new Map<string, number>();
  #listeners = new Set<() => void>();

  constructor(
    private readonly overviewStore: InMemoryOverviewStore,
    private readonly settingsStore: InMemorySettingsStore,
    private readonly transcriptStore: InMemoryTranscriptStore,
  ) {}

  async isEnrolled() {
    return this.enrolled;
  }

  async enrol() {
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

  async acknowledge(key: number, _outcome: WriteAcknowledgement) {
    this.outbox = this.outbox.filter((entry) => entry.key !== key);
  }

  async park(key: number, failure: OutboxFailure) {
    this.outbox = this.outbox.map((entry) => (entry.key === key ? { ...entry, stuck: failure } : entry));
  }

  async revisionOf(kind: OutboxKind, id: string) {
    return this.revisions.get(`${kind}/${id}`) ?? null;
  }

  async transcriptToPush(videoId: string) {
    const noted = (await this.overviewStore.listOverviews()).some((overview) => overview.video.id === videoId);
    return noted ? this.transcriptStore.getTranscript(videoId as never) : null;
  }

  async keepTranscript(transcript: StoredTranscript) {
    this.transcriptStore.seedTranscript(transcript);
  }

  async applyChanges(changes: RecordChange[], next: number) {
    for (const change of changes) {
      if (change.deleted) {
        this.revisions.delete(`${change.kind}/${change.id}`);
      } else {
        this.revisions.set(`${change.kind}/${change.id}`, change.rev);
      }
      if (change.deleted || change.body === undefined) {
        if (change.kind === "overview") await this.overviewStore.deleteOverview(change.id as never);
        continue;
      }
      switch (change.kind) {
        case "overview":
          this.overviewStore.seedOverview(Overview.parse(change.body));
          break;
        case "overviewState":
          this.overviewStore.seedState(OverviewState.parse(change.body));
          break;
        case "topic":
          this.overviewStore.seedTopic(Topic.parse(change.body));
          break;
        case "settings":
          this.settingsStore.seedSettings(Settings.parse(change.body));
          break;
      }
    }
    this.cursorValue = next;
    this.applied.push(changes);
  }

  onJournaled(listener: () => void) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  // Test-only: what a local write would have journaled, so the panel can count it.
  seedPending(entry: OutboxEntry): void {
    this.outbox.push(entry);
  }
}
