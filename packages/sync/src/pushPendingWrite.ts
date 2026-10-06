import type { OutboxEntry, OutboxFailure, SyncStorage, WrittenRecord } from "@overview/domain";
import type { SyncApi } from "./SyncApi.js";
import { isSyncRequestError } from "./SyncRequestError.js";
import { describe, stopReasonFor, type StopReason } from "./stopReasonFor.js";

export type PushOutcome =
  | { result: "written"; rev: number }
  | { result: "gone" }
  | { result: "sent" }
  | { result: "stuck"; failure: OutboxFailure }
  | { result: "stopped"; reason: StopReason; detail: string };

const REPLACE_ATTEMPTS = 3;

// One outbox entry onto the route it belongs to. A whole-record write over a record the
// server already holds is retried with the revision the server names, because a
// regeneration is the reader's deliberate act and the last local write wins, as it does
// in the local store. A field write to a record the server no longer has is done with:
// the tombstone will arrive on the next pull (docs/features/sync-client.md).
export async function pushPendingWrite(
  api: SyncApi,
  entry: OutboxEntry,
  knownRev: number | null,
  storage: Pick<SyncStorage, "transcriptToPush">,
): Promise<PushOutcome> {
  try {
    return await send(api, entry, knownRev, storage);
  } catch (error) {
    const reason = stopReasonFor(error);
    if (reason !== null) {
      return { result: "stopped", reason, detail: describe(error) };
    }
    if (isSyncRequestError(error)) {
      if (error.code === "not_found" && isFieldWrite(entry)) {
        return { result: "gone" };
      }
      return { result: "stuck", failure: { code: error.code, message: error.message } };
    }
    return { result: "stuck", failure: { code: "unknown", message: describe(error) } };
  }
}

async function send(
  api: SyncApi,
  entry: OutboxEntry,
  knownRev: number | null,
  storage: Pick<SyncStorage, "transcriptToPush">,
): Promise<PushOutcome> {
  const { change } = entry;
  switch (change.op) {
    case "replace":
      switch (entry.kind) {
        case "topic":
          return createTopic(api, change.record);
        case "followedPlaylist":
          return replaceWithRetry((ifMatch) => api.saveFollowedPlaylist(change.record, ifMatch), knownRev);
        default:
          return replaceWithRetry((ifMatch) => api.createOverview(change.record, ifMatch), knownRev);
      }
    case "topics":
      return written(await api.setOverviewTopics(entry.id, change.topicIds, entry.updatedAt));
    case "captureReason":
      return written(await api.setOverviewCaptureReason(entry.id, change.captureReason, entry.updatedAt));
    case "tags":
      return written(await api.setOverviewTags(entry.id, change.tags, entry.updatedAt));
    case "state":
      return written(await api.setOverviewState(entry.id, change.patch, entry.updatedAt));
    case "settings":
      return written(await api.updateSettings(change.patch, entry.updatedAt));
    case "delete": {
      await (entry.kind === "followedPlaylist" ? api.deleteFollowedPlaylist(entry.id) : api.deleteOverview(entry.id));
      return { result: "gone" };
    }
    case "transcript": {
      const transcript = await storage.transcriptToPush(entry.id);
      if (transcript !== null) await api.saveTranscript(transcript);
      return { result: "sent" };
    }
  }
}

const written = ({ rev }: WrittenRecord): PushOutcome => ({ result: "written", rev });

// A transcript is not a field of a record, so a 404 for one is a server without the route,
// not a tombstone on its way down.
const isFieldWrite = ({ change }: OutboxEntry): boolean => change.op !== "replace" && change.op !== "transcript";

const revisionNamedBy = (error: unknown): number | null =>
  isSyncRequestError(error) && typeof error.details?.rev === "number" ? error.details.rev : null;

async function replaceWithRetry(
  replace: (ifMatch: number | null) => Promise<WrittenRecord>,
  knownRev: number | null,
): Promise<PushOutcome> {
  let ifMatch = knownRev;
  for (let attempt = 1; ; attempt += 1) {
    try {
      return written(await replace(ifMatch));
    } catch (error) {
      const named = revisionNamedBy(error);
      if (named === null || attempt >= REPLACE_ATTEMPTS) {
        throw error;
      }
      ifMatch = named;
    }
  }
}

// Topics are create-only. One the server already holds under this id is this same topic,
// pushed once before and not acknowledged in time; there is nothing to replace.
async function createTopic(api: SyncApi, record: Record<string, unknown>): Promise<PushOutcome> {
  try {
    return written(await api.createTopic(record));
  } catch (error) {
    const named = revisionNamedBy(error);
    if (isSyncRequestError(error) && error.code === "already_exists" && named !== null) {
      return { result: "written", rev: named };
    }
    throw error;
  }
}
