import { redactErrorMessage, type ClientErrorSource, type ClientErrorTrailEntry, type SentClientError } from "@overview/domain";
import { isSyncRequestError, isSyncTransportError } from "./SyncRequestError.js";
import { parseStackFrames } from "./parseStackFrames.js";

const IDENTIFIER = /^[A-Za-z_$][\w$]{0,63}$/;

const messageOf = (error: Error | null, thrown: unknown): string => {
  if (error !== null) {
    return error.message;
  }
  if (typeof thrown === "string") {
    return thrown;
  }
  return "";
};

const typeOf = (error: Error | null): string => {
  if (error === null) {
    return "NonError";
  }
  if (IDENTIFIER.test(error.name)) {
    return error.name;
  }
  return "Error";
};

const requestOf = (thrown: unknown) => {
  if (isSyncRequestError(thrown)) {
    return { requestId: thrown.requestId, apiErrorCode: thrown.code, status: thrown.status };
  }
  if (isSyncTransportError(thrown)) {
    return { requestId: thrown.requestId };
  }
  return {};
};

export interface ToClientErrorOptions {
  source: ClientErrorSource;
  handled: boolean;
  trail: ClientErrorTrailEntry[];
  at: Date;
}

// Redacted on the device (docs/architecture/errors-and-logs.md, "What an error may carry").
export const toClientError = (thrown: unknown, { source, handled, trail, at }: ToClientErrorOptions): SentClientError => {
  const error = thrown instanceof Error ? thrown : null;
  const message = messageOf(error, thrown);
  const request = requestOf(thrown);
  return {
    source,
    type: typeOf(error),
    message: redactErrorMessage(message),
    handled,
    frames: parseStackFrames(error?.stack),
    ...Object.fromEntries(Object.entries(request).filter(([, value]) => value !== undefined)),
    trail,
    at: at.toISOString(),
  };
};
