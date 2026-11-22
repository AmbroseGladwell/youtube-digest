import type { OutboxEntry, OutboxFailure, SyncStorage, WrittenRecord } from "@overview/domain";
import type { SyncApi } from "./SyncApi.js";
import { isSyncRequestError } from "./SyncRequestError.js";
import { describe, stopReasonFor, type StopReason } from "./stopReasonFor.js";

export type PushOutcome =
  | { result: "written"; rev: number }
  | { result: "gone" }
  | { result: "sent" }
  // An outcome to resolve, not a failure to park (docs/features/one-overview-per-video.md).
  | { result: "held"; by: string }
  // Past the own-key quota: it waits in the outbox until the month turns.
  | { result: "waiting"; until: string }
  | { result: "stuck"; failure: OutboxFailure }
  | { result: "stopped"; reason: StopReason; detail: string };

const REPLACE_ATTEMPTS = 3;

// Revisions, tombstones and what is retried: docs/features/sync-client.md.
export const pushPendingWrite = async (
  api: SyncApi,
  entry: OutboxEntry,
  knownRev: number | null,
  storage: Pick<SyncStorage, "transcriptToPush">,
): Promise<PushOutcome> => {
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
};

const send = async (
  api: SyncApi,
  entry: OutboxEntry,
  knownRev: number | null,
  storage: Pick<SyncStorage, "transcriptToPush">,
): Promise<PushOutcome> => {
  const { change } = entry;
  switch (change.op) {
    case "replace":
      switch (entry.kind) {
        case "topic":
          return createTopic(api, change.record);
        case "followedPlaylist":
          return replaceWithRetry((ifMatch) => api.saveFollowedPlaylist(change.record, ifMatch), knownRev);
        case "project":
          return createOnce(() => api.createProject(change.record));
        default:
          return createOverview(api, change.record, knownRev);
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
    case "project":
      return written(await api.updateProject(entry.id, change.patch, entry.updatedAt));
    case "member": {
      const [projectId = "", overviewId = ""] = entry.id.split(":");
      const { addedBy, ...sent } = change.change;
      const filed = (addedBy as { by?: unknown } | undefined)?.by === "filing";
      return written(await api.changeProjectMember(projectId, overviewId, filed ? { ...sent, addedBy } : sent, entry.updatedAt));
    }
    case "delete": {
      await deleteFor(api, entry);
      return { result: "gone" };
    }
    case "transcript": {
      const transcript = await storage.transcriptToPush(entry.id);
      if (transcript !== null) {
        await api.saveTranscript(transcript);
      }
      return { result: "sent" };
    }
  }
};

const written = ({ rev }: WrittenRecord): PushOutcome => ({ result: "written", rev });

// A transcript isn't a field of a record, so its 404 means a server without the route.
const isFieldWrite = ({ change }: OutboxEntry): boolean => change.op !== "replace" && change.op !== "transcript";

// Only a refusal about this record's own revision names one worth retrying with.
const revisionNamedBy = (error: unknown): number | null =>
  isSyncRequestError(error) &&
  (error.code === "already_exists" || error.code === "revision_mismatch") &&
  typeof error.details?.rev === "number"
    ? error.details.rev
    : null;

const replaceWithRetry = async (
  replace: (ifMatch: number | null) => Promise<WrittenRecord>,
  knownRev: number | null,
): Promise<PushOutcome> => {
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
};

// A held video is folded; an unreserved overview takes a slot and goes again (docs/architecture/tiers.md).
const createOverview = async (api: SyncApi, record: Record<string, unknown>, knownRev: number | null): Promise<PushOutcome> => {
  const create = () => replaceWithRetry((ifMatch) => api.createOverview(record, ifMatch), knownRev);
  try {
    try {
      return await create();
    } catch (error) {
      if (!isSyncRequestError(error) || error.code !== "not_reserved") {
        throw error;
      }
      const waiting = await reserve(api, String(record.id));
      if (waiting !== null) {
        return waiting;
      }
      return await create();
    }
  } catch (error) {
    const by = isSyncRequestError(error) && error.code === "video_already_held" ? error.details?.overviewId : undefined;
    if (typeof by === "string") {
      return { result: "held", by };
    }
    throw error;
  }
};

const reserve = async (api: SyncApi, overviewId: string): Promise<PushOutcome | null> => {
  try {
    await api.reserveOverview(overviewId);
    return null;
  } catch (error) {
    const spent = isSyncRequestError(error) && (error.details?.quota === "own" || error.details?.quota === "ours");
    const until = spent ? error.details?.resetsOn : undefined;
    if (typeof until === "string") {
      return { result: "waiting", until };
    }
    throw error;
  }
};

const deleteFor = (api: SyncApi, entry: OutboxEntry): Promise<WrittenRecord | null> => {
  switch (entry.kind) {
    case "followedPlaylist":
      return api.deleteFollowedPlaylist(entry.id);
    case "project":
      return api.deleteProject(entry.id);
    case "chat":
      return api.deleteChat(entry.id);
    default:
      return api.deleteOverview(entry.id);
  }
};

const createTopic = (api: SyncApi, record: Record<string, unknown>): Promise<PushOutcome> => createOnce(() => api.createTopic(record));

// One the server already holds under this id is this same record, pushed before and not acknowledged.
const createOnce = async (create: () => Promise<WrittenRecord>): Promise<PushOutcome> => {
  try {
    return written(await create());
  } catch (error) {
    const named = revisionNamedBy(error);
    if (isSyncRequestError(error) && error.code === "already_exists" && named !== null) {
      return { result: "written", rev: named };
    }
    throw error;
  }
};
