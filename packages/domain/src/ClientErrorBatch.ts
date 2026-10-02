import { z } from "zod";
import { AnalyticsContext } from "./AnalyticsEventBatch.js";
import { isAnalyticsEventName, type AnalyticsEventName } from "./analyticsEvents.js";
import { API_ERROR_CODES, type ApiErrorCode } from "./ApiErrorCode.js";
import { MAX_ERROR_MESSAGE_LENGTH, redactErrorMessage } from "./redactErrorMessage.js";
import { RequestId } from "./RequestId.js";

export const MAX_CLIENT_ERROR_BATCH = 10;
export const MAX_ERROR_FRAMES = 30;
export const MAX_ERROR_TRAIL = 20;

// Where the app caught it, which says as much about a failure as its stack does.
export const ClientErrorSource = z.enum([
  "uncaught",
  "unhandledRejection",
  "routeBoundary",
  "errorState",
  "failedRequest",
  "serviceWorker",
  "startup",
]);
export type ClientErrorSource = z.infer<typeof ClientErrorSource>;

// A stack frame cut down to the app's own code: a function name and a path inside the
// bundle, never a page's address (docs/architecture/errors-and-logs.md, "What an error may carry").
export const ClientErrorFrame = z
  .object({
    function: z.string().max(128).regex(/^[\w$.<>[\] -]*$/),
    file: z.string().max(200).regex(/^[\w./@~+-]*$/),
    line: z.number().int().min(0).max(10_000_000),
    column: z.number().int().min(0).max(10_000_000),
    // The id PostHog's CLI injected into the frame's file, which its source map was uploaded under.
    chunkId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).optional(),
  })
  .strict();
export type ClientErrorFrame = z.infer<typeof ClientErrorFrame>;

// What the reader did before it, by name and time only.
export const ClientErrorTrailEntry = z
  .object({
    name: z.string().max(64),
    at: z.iso.datetime(),
  })
  .strict();
export type ClientErrorTrailEntry = z.infer<typeof ClientErrorTrailEntry>;

export const SentClientError = z
  .object({
    source: ClientErrorSource,
    type: z.string().max(64).regex(/^[A-Za-z_$][\w$]*$/),
    message: z.string().max(MAX_ERROR_MESSAGE_LENGTH + 50),
    handled: z.boolean(),
    frames: z.array(ClientErrorFrame).max(MAX_ERROR_FRAMES),
    // The failing call's id, which the server logged it under.
    requestId: RequestId.optional(),
    apiErrorCode: z.string().max(64).optional(),
    status: z.number().int().min(0).max(599).optional(),
    trail: z.array(ClientErrorTrailEntry).max(MAX_ERROR_TRAIL),
    at: z.iso.datetime(),
  })
  .strict();
export type SentClientError = z.infer<typeof SentClientError>;

export const ClientErrorBatch = z
  .object({
    context: AnalyticsContext,
    errors: z.array(SentClientError).min(1).max(MAX_CLIENT_ERROR_BATCH),
    // How many errors the app couldn't send or hold since its last batch got through.
    dropped: z.number().int().min(1).max(100_000).optional(),
  })
  .strict();
export type ClientErrorBatch = z.infer<typeof ClientErrorBatch>;

export interface ClientError extends Omit<SentClientError, "apiErrorCode" | "trail"> {
  apiErrorCode?: ApiErrorCode;
  trail: Array<{ name: AnalyticsEventName; at: string }>;
}

// The client redacted it already; the server doesn't take its word (docs/architecture/errors-and-logs.md).
export function readClientError(sent: SentClientError): ClientError {
  const { apiErrorCode, trail, message, ...rest } = sent;
  return {
    ...rest,
    message: redactErrorMessage(message),
    ...(apiErrorCode !== undefined && apiErrorCode in API_ERROR_CODES ? { apiErrorCode: apiErrorCode as ApiErrorCode } : {}),
    trail: trail.filter((entry): entry is { name: AnalyticsEventName; at: string } => isAnalyticsEventName(entry.name)),
  };
}
