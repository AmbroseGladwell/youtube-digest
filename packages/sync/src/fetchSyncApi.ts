import { z } from "zod";
import { Handshake, RecordChangesPage, StoredTranscript, WrittenRecord } from "@overview/domain";
import { answered, createApiRequester, type ApiRequesterOptions } from "./apiRequest.js";
import type { SyncApi } from "./SyncApi.js";
import { isSyncRequestError } from "./SyncRequestError.js";

export type FetchSyncApiOptions = ApiRequesterOptions;

export function createFetchSyncApi(options: FetchSyncApiOptions): SyncApi {
  const request = createApiRequester(options);
  const written = answered<WrittenRecord>;

  return {
    handshake: () => answered(request("GET", "/handshake", Handshake)),
    changes: (since, limit = 200) =>
      answered(request("GET", `/changes?since=${since}&limit=${limit}`, RecordChangesPage)),
    createOverview: (record, ifMatch) => written(request("POST", "/overviews", WrittenRecord, { body: record, ifMatch })),
    setOverviewTopics: (id, topicIds, updatedAt) =>
      written(request("PUT", `/overviews/${id}/topics`, WrittenRecord, { body: { topicIds, updatedAt } })),
    setOverviewCaptureReason: (id, captureReason, updatedAt) =>
      written(request("PUT", `/overviews/${id}/capture-reason`, WrittenRecord, { body: { captureReason, updatedAt } })),
    setOverviewTags: (id, tags, updatedAt) =>
      written(request("PUT", `/overviews/${id}/tags`, WrittenRecord, { body: { tags, updatedAt } })),
    setOverviewState: (id, patch, updatedAt) =>
      written(request("PUT", `/overviews/${id}/state`, WrittenRecord, { body: { ...patch, updatedAt } })),
    deleteOverview: (id) => request("DELETE", `/overviews/${id}`, WrittenRecord),
    createTopic: (record) => written(request("POST", "/topics", WrittenRecord, { body: record })),
    updateSettings: (patch, updatedAt) =>
      written(request("PUT", "/settings", WrittenRecord, { body: { ...patch, updatedAt } })),
    saveFollowedPlaylist: (record, ifMatch) =>
      written(request("POST", "/followed-playlists", WrittenRecord, { body: record, ifMatch })),
    deleteFollowedPlaylist: (id) => request("DELETE", `/followed-playlists/${encodeURIComponent(id)}`, WrittenRecord),
    saveTranscript: async (transcript) => {
      await request("PUT", `/transcripts/${encodeURIComponent(transcript.videoId)}`, z.unknown(), { body: transcript });
    },
    getTranscript: (videoId) =>
      answered(request("GET", `/transcripts/${encodeURIComponent(videoId)}`, StoredTranscript)).catch((error: unknown) => {
        if (isSyncRequestError(error) && error.code === "not_found") return null;
        throw error;
      }),
  };
}
