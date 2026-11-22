import type { z } from "zod";
import {
  API_ERROR_CODES,
  ApiErrorEnvelope,
  type AuthSurface,
  CLIENT_SURFACE_HEADER,
  CLIENT_VERSION,
  CLIENT_VERSION_HEADER,
  REQUEST_ID_HEADER,
  TRIAL_TOKEN_HEADER,
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
  // Absent, the browser's cookie for the API's origin is the session (docs/features/sign-in.md).
  token?: string | null | undefined;
  // The signed-out trial's token, which our-key overviews count against (docs/architecture/tiers.md).
  trialToken?: string | null | undefined;
  clientVersion?: number | undefined;
  // Which shell is asking, sent so the server's logs can tell the two apart.
  surface?: AuthSurface | undefined;
  fetch?: typeof fetch | undefined;
  newRequestId?: () => string;
}

export type ApiRequester = <T>(method: ApiMethod, path: string, schema: z.ZodType<T>, options?: ApiRequestOptions) => Promise<T | null>;

export interface ApiCall {
  url: string;
  init: RequestInit;
  requestId: string;
  fetch: typeof fetch;
}

export const createApiCaller = ({
  baseUrl,
  token = null,
  trialToken = null,
  clientVersion = CLIENT_VERSION,
  surface,
  fetch: fetchImpl = globalThis.fetch,
  newRequestId = () => globalThis.crypto.randomUUID(),
}: ApiRequesterOptions): ((method: ApiMethod, path: string, options?: ApiRequestOptions & { signal?: AbortSignal }) => ApiCall) => {
  const root = baseUrl.replace(/\/+$/, "");
  return (method, path, { body, ifMatch, keepalive = false, signal } = {}) => {
    const requestId = newRequestId();
    return {
      url: `${root}/api${path}`,
      requestId,
      fetch: fetchImpl,
      init: {
        method,
        headers: {
          ...(token === null ? {} : { authorization: `Bearer ${token}` }),
          ...(trialToken === null ? {} : { [TRIAL_TOKEN_HEADER]: trialToken }),
          [CLIENT_VERSION_HEADER]: String(clientVersion),
          ...(surface === undefined ? {} : { [CLIENT_SURFACE_HEADER]: surface }),
          [REQUEST_ID_HEADER]: requestId,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...(ifMatch === null || ifMatch === undefined ? {} : { "if-match": `"${ifMatch}"` }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        ...(keepalive ? { keepalive } : {}),
        ...(signal === undefined ? {} : { signal }),
      },
    };
  };
};

export const sendApiCall = async ({ url, init, requestId, fetch: fetchImpl }: ApiCall): Promise<Response> => {
  try {
    return await fetchImpl(url, init);
  } catch (error) {
    throw new SyncTransportError("The sync server could not be reached", { cause: error, requestId });
  }
};

export const refusalOf = async (response: Response, requestId: string): Promise<Error> => {
  let json: unknown;
  try {
    json = await response.json();
  } catch (error) {
    return new SyncTransportError(`The sync server answered ${response.status} without a readable body`, { cause: error, requestId });
  }
  const envelope = ApiErrorEnvelope.safeParse(json);
  if (!envelope.success) {
    return new SyncTransportError(`The sync server answered ${response.status} with something other than an API error`, { requestId });
  }
  const { code, message, details } = envelope.data.error;
  return new SyncRequestError(
    code in API_ERROR_CODES ? (code as ApiErrorCode) : "internal_error",
    response.status,
    message,
    details,
    requestId,
  );
};

export const createApiRequester = (options: ApiRequesterOptions): ApiRequester => {
  const call = createApiCaller(options);
  return async <T>(method: ApiMethod, path: string, schema: z.ZodType<T>, requestOptions: ApiRequestOptions = {}): Promise<T | null> => {
    const prepared = call(method, path, requestOptions);
    const { requestId } = prepared;
    const response = await sendApiCall(prepared);
    if (response.status === 204) {
      return null;
    }
    if (!response.ok) {
      throw await refusalOf(response, requestId);
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
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new SyncTransportError(`The sync server's answer to ${method} ${path} did not have the expected shape`, {
        cause: parsed.error,
        requestId,
      });
    }
    return parsed.data;
  };
};

export const answered = async <T>(promise: Promise<T | null>): Promise<T> => {
  const result = await promise;
  if (result === null) {
    throw new SyncTransportError("The sync server answered with no content where content was expected");
  }
  return result;
};
