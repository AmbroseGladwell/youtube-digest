import { CLIENT_VERSION, type RecordChange, type SyncStorage, type SyncedRecordKind } from "@overview/domain";
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
  // Called after a page of the feed has landed locally, so a screen can re-read.
  onApplied?: ((changes: RecordChange[]) => void) | undefined;
}

export interface SyncEngineSchedule {
  intervalMs?: number | undefined;
  journalDebounceMs?: number | undefined;
}

const pendingKey = (kind: SyncedRecordKind, id: string) => `${kind}/${id}`;

// One cycle is handshake, enrol if never enrolled, push the outbox in order, then pull
// the feed to its end. Push goes before pull so that what comes back already carries this
// device's writes. A cycle asked for while one is running runs once after it, not once
// per ask (docs/features/sync-client.md).
export class SyncEngine {
  #api: SyncApi;
  #storage: SyncStorage;
  #clientVersion: number;
  #now: () => Date;
  #pageSize: number;
  #onApplied: ((changes: RecordChange[]) => void) | undefined;
  #status: SyncStatus = INITIAL_SYNC_STATUS;
  #listeners = new Set<(status: SyncStatus) => void>();
  #running: Promise<SyncStatus> | null = null;
  #askedAgain = false;

  constructor({ api, storage, clientVersion = CLIENT_VERSION, now = () => new Date(), pageSize = 200, onApplied }: SyncEngineOptions) {
    this.#api = api;
    this.#storage = storage;
    this.#clientVersion = clientVersion;
    this.#now = now;
    this.#pageSize = pageSize;
    this.#onApplied = onApplied;
  }

  get status(): SyncStatus {
    return this.#status;
  }

  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  // Settles once no cycle is running, for a caller about to take the storage away.
  async whenIdle(): Promise<void> {
    while (this.#running !== null) {
      await this.#running.catch(() => undefined);
    }
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
      if (debounce !== null) clearTimeout(debounce);
      debounce = setTimeout(() => {
        debounce = null;
        void this.sync();
      }, journalDebounceMs);
    };
    const onWake = () => void this.sync();
    const onVisible = () => {
      if (globalThis.document?.visibilityState === "visible") onWake();
    };

    const stopJournal = this.#storage.onJournaled(soon);
    const interval = setInterval(onWake, intervalMs);
    globalThis.addEventListener?.("online", onWake);
    globalThis.document?.addEventListener("visibilitychange", onVisible);
    void this.sync();

    return () => {
      stopJournal();
      clearInterval(interval);
      if (debounce !== null) clearTimeout(debounce);
      globalThis.removeEventListener?.("online", onWake);
      globalThis.document?.removeEventListener("visibilitychange", onVisible);
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
        if (stopped !== null) return this.#stop(stopped.reason, stopped.detail);
      }
      const stopped = await this.#pull();
      if (stopped !== null) return this.#stop(stopped.reason, stopped.detail);
    } catch (error) {
      return this.#stop("failed", describe(error));
    }

    return belowFloor
      ? this.#stop("unsupported", "This version of the app can no longer write. Update it.")
      : this.#finish();
  }

  async #push(): Promise<{ reason: StopReason; detail: string } | null> {
    const blocked = new Set<string>();
    for (const entry of await this.#storage.listPending()) {
      const key = pendingKey(entry.kind, entry.id);
      if (entry.stuck !== null) {
        blocked.add(key);
        continue;
      }
      if (blocked.has(key)) {
        continue;
      }
      const outcome = await pushPendingWrite(
        this.#api,
        entry,
        await this.#storage.revisionOf(entry.kind, entry.id),
      );
      switch (outcome.result) {
        case "written":
          await this.#storage.acknowledge(entry.key, { rev: outcome.rev });
          break;
        case "gone":
          await this.#storage.acknowledge(entry.key, { tombstoned: true });
          break;
        case "stuck":
          await this.#storage.park(entry.key, outcome.failure);
          blocked.add(key);
          break;
        case "stopped":
          return { reason: outcome.reason, detail: outcome.detail };
      }
    }
    return null;
  }

  async #pull(): Promise<{ reason: StopReason; detail: string } | null> {
    let since = await this.#storage.cursor();
    for (;;) {
      let page;
      try {
        page = await this.#api.changes(since, this.#pageSize);
      } catch (error) {
        return { reason: stopReasonFor(error) ?? "failed", detail: describe(error) };
      }
      await this.#storage.applyChanges(page.changes, page.next);
      if (page.changes.length > 0) this.#onApplied?.(page.changes);
      since = page.next;
      if (!page.more) return null;
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
    for (const listener of this.#listeners) listener(this.#status);
    return this.#status;
  }
}
