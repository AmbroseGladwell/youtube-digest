import type { Handshake, RecordChange, RecordChangesPage, StoredTranscript, WrittenRecord } from "@overview/domain";
import { CLIENT_VERSION, type ApiErrorCode, API_ERROR_CODES } from "@overview/domain";
import type { SyncApi } from "./SyncApi.js";
import { SyncRequestError, SyncTransportError } from "./SyncRequestError.js";

export interface ApiCall {
  method: keyof SyncApi;
  args: unknown[];
}

type Failure = { code: ApiErrorCode; details?: Record<string, unknown> } | "transport";

// A server that answers from a script: every call is recorded, any call can be told to
// fail once or always, and the feed is whatever pages the test queued.
export class ScriptedSyncApi implements SyncApi {
  calls: ApiCall[] = [];
  handshakeAnswer: Handshake = { minSupportedClientVersion: 1, currentClientVersion: CLIENT_VERSION };
  pages: RecordChangesPage[] = [];
  transcripts = new Map<string, StoredTranscript>();
  #rev = 0;
  #failures = new Map<keyof SyncApi, Failure[]>();
  #alwaysFail = new Map<keyof SyncApi, Failure>();

  failOnce(method: keyof SyncApi, failure: Failure): void {
    this.#failures.set(method, [...(this.#failures.get(method) ?? []), failure]);
  }

  failAlways(method: keyof SyncApi, failure: Failure): void {
    this.#alwaysFail.set(method, failure);
  }

  queuePage(changes: RecordChange[], more = false): void {
    const next = changes.at(-1)?.seq ?? this.pages.at(-1)?.next ?? 0;
    this.pages.push({ changes, next, more });
  }

  callsTo(method: keyof SyncApi): ApiCall[] {
    return this.calls.filter((call) => call.method === method);
  }

  #answer<T>(method: keyof SyncApi, args: unknown[], answer: () => T): T {
    this.calls.push({ method, args });
    const queued = this.#failures.get(method);
    const failure = queued?.shift() ?? this.#alwaysFail.get(method);
    if (failure === "transport") throw new SyncTransportError("no network");
    if (failure !== undefined) {
      throw new SyncRequestError(failure.code, API_ERROR_CODES[failure.code], `simulated ${failure.code}`, failure.details);
    }
    return answer();
  }

  #written = (id: string): WrittenRecord => ({ id, rev: ++this.#rev, seq: this.#rev });

  async handshake() {
    return this.#answer("handshake", [], () => this.handshakeAnswer);
  }

  async changes(since: number, limit?: number) {
    return this.#answer("changes", [since, limit], () => this.pages.shift() ?? { changes: [], next: since, more: false });
  }

  async createOverview(record: Record<string, unknown>, ifMatch: number | null) {
    return this.#answer("createOverview", [record, ifMatch], () => this.#written(String(record.id)));
  }

  async setOverviewTopics(id: string, topicIds: string[], updatedAt: string) {
    return this.#answer("setOverviewTopics", [id, topicIds, updatedAt], () => this.#written(id));
  }

  async setOverviewCaptureReason(id: string, captureReason: string | null, updatedAt: string) {
    return this.#answer("setOverviewCaptureReason", [id, captureReason, updatedAt], () => this.#written(id));
  }

  async setOverviewState(id: string, patch: Record<string, unknown>, updatedAt: string) {
    return this.#answer("setOverviewState", [id, patch, updatedAt], () => this.#written(id));
  }

  async deleteOverview(id: string) {
    return this.#answer("deleteOverview", [id], () => null);
  }

  async createTopic(record: Record<string, unknown>) {
    return this.#answer("createTopic", [record], () => this.#written(String(record.id)));
  }

  async updateSettings(patch: Record<string, unknown>, updatedAt: string) {
    return this.#answer("updateSettings", [patch, updatedAt], () => this.#written("settings"));
  }

  async saveTranscript(transcript: StoredTranscript) {
    return this.#answer("saveTranscript", [transcript], () => {
      this.transcripts.set(transcript.videoId, transcript);
    });
  }

  async getTranscript(videoId: string) {
    return this.#answer("getTranscript", [videoId], () => this.transcripts.get(videoId) ?? null);
  }
}
