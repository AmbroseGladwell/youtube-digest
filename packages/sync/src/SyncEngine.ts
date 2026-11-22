import {
  CLIENT_VERSION,
  type OutboxEntry,
  type OutboxFailure,
  type OutboxKind,
  type OverviewFold,
  type RecordChange,
  type StoredTranscript,
  type SyncStorage,
} from "@overview/domain";
import { pushPendingWrite } from "./pushPendingWrite.js";
import type { SyncApi } from "./SyncApi.js";
import { INITIAL_SYNC_STATUS, type SyncStatus } from "./SyncStatus.js";
import { describe, stopReasonFor, type StopReason } from "./stopReasonFor.js";

export interface SyncEngineOptions {
  api: SyncApi;
  storage: SyncStorage;
  clientVersion?: number | undefined;
  now?: (() => Date) | undefined;
  pageSize?: number | undefined;
  onApplied?: ((changes: RecordChange[]) => void) | undefined;
  onFolded?: ((fold: OverviewFold) => void) | undefined;
}

export interface SyncEngineSchedule {
  intervalMs?: number | undefined;
  journalDebounceMs?: number | undefined;
}

const pendingKey = (kind: OutboxKind, id: string) => `${kind}/${id}`;

const HELD_ELSEWHERE: OutboxFailure = {
  code: "video_already_held",
  message: "The account already holds an overview of this video, and this device cannot read it yet",
};

export interface SyncStop {
  reason: StopReason;
  detail: string;
}

// The cycle, and why push goes before pull: docs/features/sync-client.md, "One cycle".
export class SyncEngine {
  #api: SyncApi;
  #storage: SyncStorage;
  #clientVersion: number;
  #now: () => Date;
  #pageSize: number;
  #onApplied: ((changes: RecordChange[]) => void) | undefined;
  #onFolded: ((fold: OverviewFold) => void) | undefined;
  #status: SyncStatus = INITIAL_SYNC_STATUS;
  #listeners = new Set<(status: SyncStatus) => void>();
  #running: Promise<SyncStatus> | null = null;
  #askedAgain = false;
  // Overviews refused for a full month, until it resets: asking again sooner is refused again.
  #waitingUntil = new Map<string, number>();

  constructor({
    api,
    storage,
    clientVersion = CLIENT_VERSION,
    now = () => new Date(),
    pageSize = 200,
    onApplied,
    onFolded,
  }: SyncEngineOptions) {
    this.#api = api;
    this.#storage = storage;
    this.#clientVersion = clientVersion;
    this.#now = now;
    this.#pageSize = pageSize;
    this.#onApplied = onApplied;
    this.#onFolded = onFolded;
  }

  get status(): SyncStatus {
    return this.#status;
  }

  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  async whenIdle(): Promise<void> {
    while (this.#running !== null) {
      await this.#running.catch(() => undefined);
    }
  }

  // Asked for when the reader opens it, not pulled with the feed (docs/features/transcript-storage.md).
  async fetchTranscript(videoId: string): Promise<StoredTranscript | null> {
    const transcript = await this.#api.getTranscript(videoId);
    if (transcript !== null) {
      await this.#storage.keepTranscript(transcript);
    }
    return transcript;
  }

  retryWaiting(): void {
    if (this.#waitingUntil.size === 0) {
      return;
    }
    this.#waitingUntil.clear();
    void this.sync();
  }

  sync(): Promise<SyncStatus> {
    if (this.#running !== null) {
      this.#askedAgain = true;
      return this.#running;
    }
    this.#running = this.#cycle().finally(() => {
      this.#running = null;
      if (this.#askedAgain) {
        this.#askedAgain = false;
        void this.sync();
      }
    });
    return this.#running;
  }

  start({ intervalMs = 60_000, journalDebounceMs = 250 }: SyncEngineSchedule = {}): () => void {
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const soon = () => {
      if (debounce !== null) {
        clearTimeout(debounce);
      }
      debounce = setTimeout(() => {
        debounce = null;
        void this.sync();
      }, journalDebounceMs);
    };
    const onWake = () => void this.sync();
    // A hidden tab doesn't poll, so the server and database can sleep; it catches up when shown.
    const hidden = () => globalThis.document?.visibilityState === "hidden";
    let interval: ReturnType<typeof setInterval> | null = null;
    const poll = () => {
      interval ??= setInterval(onWake, intervalMs);
    };
    const pause = () => {
      if (interval !== null) {
        clearInterval(interval);
      }
      interval = null;
    };
    const onVisibility = () => {
      if (hidden()) {
        pause();
      } else {
        poll();
        onWake();
      }
    };

    const stopJournal = this.#storage.onJournaled(soon);
    if (!hidden()) {
      poll();
    }
    globalThis.addEventListener?.("online", onWake);
    globalThis.document?.addEventListener("visibilitychange", onVisibility);
    void this.sync();

    return () => {
      stopJournal();
      pause();
      if (debounce !== null) {
        clearTimeout(debounce);
      }
      globalThis.removeEventListener?.("online", onWake);
      globalThis.document?.removeEventListener("visibilitychange", onVisibility);
    };
  }

  async #cycle(): Promise<SyncStatus> {
    this.#publish({ phase: "syncing", detail: null });

    let handshake;
    try {
      handshake = await this.#api.handshake();
    } catch (error) {
      return this.#stop(stopReasonFor(error) ?? "failed", describe(error));
    }
    this.#publish({ handshake });
    const belowFloor = this.#clientVersion < handshake.minSupportedClientVersion;

    try {
      if (!(await this.#storage.isEnrolled())) {
        await this.#storage.enrol();
      }
      if (!belowFloor) {
        const stopped = await this.#push();
        if (stopped !== null) {
          return this.#stop(stopped.reason, stopped.detail);
        }
      }
      const stopped = await this.#pull();
      if (stopped !== null) {
        return this.#stop(stopped.reason, stopped.detail);
      }
    } catch (error) {
      return this.#stop("failed", describe(error));
    }

    return belowFloor ? this.#stop("unsupported", "This version of the app can no longer write. Update it.") : this.#finish();
  }

  // A fold rewrites the outbox, so the pass starts again from what is pending now.
  async #push(): Promise<SyncStop | null> {
    for (;;) {
      const pass = await this.#pushPass();
      if (pass !== "folded") {
        return pass;
      }
    }
  }

  async #pushPass(): Promise<SyncStop | "folded" | null> {
    const blocked = new Set<string>();
    for (const entry of await this.#storage.listPending()) {
      const key = pendingKey(entry.kind, entry.id);
      if (entry.stuck !== null) {
        blocked.add(key);
        continue;
      }
      if (blocked.has(key) || this.#waitsBehindParkedNote(entry, blocked)) {
        continue;
      }
      if (this.#stillWaiting(key)) {
        blocked.add(key);
        continue;
      }
      const outcome = await pushPendingWrite(this.#api, entry, await this.#storage.revisionOf(entry.kind, entry.id), this.#storage);
      switch (outcome.result) {
        case "written":
          await this.#storage.acknowledge(entry.key, { rev: outcome.rev });
          break;
        case "gone":
          await this.#storage.acknowledge(entry.key, { tombstoned: true });
          break;
        case "sent":
          await this.#storage.acknowledge(entry.key, { sent: true });
          break;
        case "held": {
          const folded = await this.#fold(entry, outcome.by);
          if (folded === "folded") {
            return "folded";
          }
          if (folded !== null) {
            return folded;
          }
          blocked.add(key);
          break;
        }
        case "stuck":
          await this.#storage.park(entry.key, outcome.failure);
          blocked.add(key);
          break;
        case "waiting": {
          const until = Date.parse(outcome.until);
          if (Number.isFinite(until)) {
            this.#waitingUntil.set(key, until);
          }
          blocked.add(key);
          break;
        }
        case "stopped":
          return { reason: outcome.reason, detail: outcome.detail };
      }
    }
    return null;
  }

  #stillWaiting(key: string): boolean {
    const until = this.#waitingUntil.get(key);
    if (until === undefined) {
      return false;
    }
    if (until > this.#now().getTime()) {
      return true;
    }
    this.#waitingUntil.delete(key);
    return false;
  }

  // The account's copy wins (docs/features/one-overview-per-video.md).
  async #fold(entry: OutboxEntry, winnerId: string): Promise<SyncStop | "folded" | null> {
    const stopped = await this.#pull();
    if (stopped !== null) {
      return stopped;
    }
    const fold = await this.#storage.foldOverview(entry.id, winnerId);
    if (fold === null) {
      await this.#storage.park(entry.key, HELD_ELSEWHERE);
      return null;
    }
    this.#onFolded?.(fold);
    return "folded";
  }

  // The server keeps a transcript only once its note is there.
  #waitsBehindParkedNote({ change }: OutboxEntry, blocked: Set<string>): boolean {
    return change.op === "transcript" && blocked.has(pendingKey("overview", change.overviewId));
  }

  async #pull(): Promise<SyncStop | null> {
    let since = await this.#storage.cursor();
    for (;;) {
      let page;
      try {
        page = await this.#api.changes(since, this.#pageSize);
      } catch (error) {
        return { reason: stopReasonFor(error) ?? "failed", detail: describe(error) };
      }
      await this.#storage.applyChanges(page.changes, page.next);
      if (page.changes.length > 0) {
        this.#onApplied?.(page.changes);
      }
      since = page.next;
      if (!page.more) {
        return null;
      }
    }
  }

  async #stop(reason: StopReason, detail: string): Promise<SyncStatus> {
    return this.#publish({ phase: reason, detail, ...(await this.#counts()) });
  }

  async #finish(): Promise<SyncStatus> {
    return this.#publish({
      phase: "idle",
      detail: null,
      lastSyncedAt: this.#now().toISOString(),
      ...(await this.#counts()),
    });
  }

  async #counts(): Promise<Pick<SyncStatus, "pending" | "stuck">> {
    const entries = await this.#storage.listPending();
    const stuck = entries.filter((entry) => entry.stuck !== null).length;
    return { pending: entries.length - stuck, stuck };
  }

  #publish(patch: Partial<SyncStatus>): SyncStatus {
    this.#status = { ...this.#status, ...patch };
    for (const listener of this.#listeners) {
      listener(this.#status);
    }
    return this.#status;
  }
}
