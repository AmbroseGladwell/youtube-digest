import type { ApiErrorCode } from "@overview/domain";

// The server answered, and said no, in the one envelope every /api failure wears
// (docs/architecture/api.md).
export class SyncRequestError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: ApiErrorCode, status: number, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "SyncRequestError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const isSyncRequestError = (error: unknown): error is SyncRequestError =>
  error instanceof SyncRequestError;

// The server did not answer, or answered with something that is not the API: no network,
// a proxy's error page, a body that fails the schema.
export class SyncTransportError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SyncTransportError";
  }
}

export const isSyncTransportError = (error: unknown): error is SyncTransportError =>
  error instanceof SyncTransportError;
