import { redactErrorMessage, type ClientErrorSource, type ClientErrorTrailEntry, type SentClientError } from "@overview/domain";
import { isSyncRequestError, isSyncTransportError } from "@overview/sync";
import { parseStackFrames } from "./util/parseStackFrames.js";

const IDENTIFIER = /^[A-Za-z_$][\w$]{0,63}$/;

export interface ToClientErrorOptions {
  source: ClientErrorSource;
  handled: boolean;
  trail: ClientErrorTrailEntry[];
  at: Date;
}

// Anything thrown, as the report the app may send: redacted on the device, with the failing
// call's id when it was a call to the API (docs/architecture/errors-and-logs.md).
export function toClientError(thrown: unknown, { source, handled, trail, at }: ToClientErrorOptions): SentClientError {
  const error = thrown instanceof Error ? thrown : null;
  const message = error !== null ? error.message : typeof thrown === "string" ? thrown : "";
  const request = isSyncRequestError(thrown)
    ? { requestId: thrown.requestId, apiErrorCode: thrown.code, status: thrown.status }
    : isSyncTransportError(thrown)
      ? { requestId: thrown.requestId }
      : {};
  return {
    source,
    type: error !== null && IDENTIFIER.test(error.name) ? error.name : error !== null ? "Error" : "NonError",
    message: redactErrorMessage(message),
    handled,
    frames: parseStackFrames(error?.stack),
    ...Object.fromEntries(Object.entries(request).filter(([, value]) => value !== undefined)),
    trail,
    at: at.toISOString(),
  };
}
