import { z } from "zod";
import {
  API_ERROR_CODES,
  ApiErrorEnvelope,
  CLIENT_VERSION,
  CLIENT_VERSION_HEADER,
  Handshake,
  RecordChangesPage,
  WrittenRecord,
  type ApiErrorCode,
} from "@overview/domain";
import type { SyncApi } from "./SyncApi.js";
import { SyncRequestError, SyncTransportError } from "./SyncRequestError.js";

export interface FetchSyncApiOptions {
  baseUrl: string;
  token: string;
  clientVersion?: number | undefined;
  fetch?: typeof fetch | undefined;
}

interface RequestOptions {
  body?: unknown;
  ifMatch?: number | null | undefined;
}

export function createFetchSyncApi({
  baseUrl,
  token,
  clientVersion = CLIENT_VERSION,
  fetch: fetchImpl = globalThis.fetch,
}: FetchSyncApiOptions): SyncApi {
  const root = baseUrl.replace(/\/+$/, "");

  const request = async <T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    schema: z.ZodType<T>,
    { body, ifMatch }: RequestOptions = {},
  ): Promise<T | null> => {
    let response: Response;
    try {
      response = await fetchImpl(`${root}/api${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          [CLIENT_VERSION_HEADER]: String(clientVersion),
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...(ifMatch === null || ifMatch === undefined ? {} : { "if-match": `"${ifMatch}"` }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch (error) {
      throw new SyncTransportError("The sync server could not be reached", { cause: error });
    }

    if (response.status === 204) {
      return null;
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch (error) {
      throw new SyncTransportError(`The sync server answered ${response.status} without a readable body`, {
        cause: error,
      });
    }

    if (!response.ok) {
      const envelope = ApiErrorEnvelope.safeParse(json);
      if (!envelope.success) {
        throw new SyncTransportError(`The sync server answered ${response.status} with something other than an API error`);
      }
      const { code, message, details } = envelope.data.error;
      throw new SyncRequestError(
        code in API_ERROR_CODES ? (code as ApiErrorCode) : "internal_error",
        response.status,
        message,
        details,
      );
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new SyncTransportError(`The sync server's answer to ${method} ${path} did not have the expected shape`, {
        cause: parsed.error,
      });
    }
    return parsed.data;
  };

  const answered = async <T>(promise: Promise<T | null>): Promise<T> => {
    const result = await promise;
    if (result === null) {
      throw new SyncTransportError("The sync server answered with no content where content was expected");
    }
    return result;
  };
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
    setOverviewState: (id, patch, updatedAt) =>
      written(request("PUT", `/overviews/${id}/state`, WrittenRecord, { body: { ...patch, updatedAt } })),
    deleteOverview: (id) => request("DELETE", `/overviews/${id}`, WrittenRecord),
    createTopic: (record) => written(request("POST", "/topics", WrittenRecord, { body: record })),
    updateSettings: (patch, updatedAt) =>
      written(request("PUT", "/settings", WrittenRecord, { body: { ...patch, updatedAt } })),
  };
}
