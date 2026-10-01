import { z } from "zod";
import {
  API_ERROR_CODES,
  ApiErrorEnvelope,
  CLIENT_VERSION,
  CLIENT_VERSION_HEADER,
  REQUEST_ID_HEADER,
  type ApiErrorCode,
} from "@overview/domain";
import { SyncRequestError, SyncTransportError } from "./SyncRequestError.js";

export type ApiMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface ApiRequestOptions {
  body?: unknown;
  ifMatch?: number | null | undefined;
  // Lets the request outlive the page that sent it, for what is sent as a page is left.
  keepalive?: boolean;
}

export interface ApiRequesterOptions {
  baseUrl: string;
  // The bearer, for a shell whose session is a token it holds. Absent, the browser's own
  // cookie for the API's origin is the session, which is the web app's transport
  // (docs/features/sign-in.md).
  token?: string | null | undefined;
  clientVersion?: number | undefined;
  fetch?: typeof fetch | undefined;
  newRequestId?: () => string;
}

export type ApiRequester = <T>(
  method: ApiMethod,
  path: string,
  schema: z.ZodType<T>,
  options?: ApiRequestOptions,
) => Promise<T | null>;

// One request against /api: the headers every call carries, the envelope every failure
// wears, and the schema every answer is parsed with (docs/architecture/api.md).
export function createApiRequester({
  baseUrl,
  token = null,
  clientVersion = CLIENT_VERSION,
  fetch: fetchImpl = globalThis.fetch,
  newRequestId = () => globalThis.crypto.randomUUID(),
}: ApiRequesterOptions): ApiRequester {
  const root = baseUrl.replace(/\/+$/, "");

  return async <T>(
    method: ApiMethod,
    path: string,
    schema: z.ZodType<T>,
    { body, ifMatch, keepalive = false }: ApiRequestOptions = {},
  ): Promise<T | null> => {
    const requestId = newRequestId();
    let response: Response;
    try {
      response = await fetchImpl(`${root}/api${path}`, {
        method,
        headers: {
          ...(token === null ? {} : { authorization: `Bearer ${token}` }),
          [CLIENT_VERSION_HEADER]: String(clientVersion),
          [REQUEST_ID_HEADER]: requestId,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...(ifMatch === null || ifMatch === undefined ? {} : { "if-match": `"${ifMatch}"` }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        ...(keepalive ? { keepalive } : {}),
      });
    } catch (error) {
      throw new SyncTransportError("The sync server could not be reached", { cause: error, requestId });
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
        requestId,
      });
    }

    if (!response.ok) {
      const envelope = ApiErrorEnvelope.safeParse(json);
      if (!envelope.success) {
        throw new SyncTransportError(`The sync server answered ${response.status} with something other than an API error`, {
          requestId,
        });
      }
      const { code, message, details } = envelope.data.error;
      throw new SyncRequestError(
        code in API_ERROR_CODES ? (code as ApiErrorCode) : "internal_error",
        response.status,
        message,
        details,
        requestId,
      );
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new SyncTransportError(`The sync server's answer to ${method} ${path} did not have the expected shape`, {
        cause: parsed.error,
        requestId,
      });
    }
    return parsed.data;
  };
}

export async function answered<T>(promise: Promise<T | null>): Promise<T> {
  const result = await promise;
  if (result === null) {
    throw new SyncTransportError("The sync server answered with no content where content was expected");
  }
  return result;
}
