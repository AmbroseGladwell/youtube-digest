import type { AnalyticsContext, ClientError } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";

export interface ErrorSource {
  // Null for a reader with no account: an error is reported whether or not they can be counted.
  accountId: AccountId | null;
  context: AnalyticsContext;
  geoAddress: string | null;
}

export interface ServerErrorFrame {
  function: string;
  file: string;
  line: number;
  column: number;
  inApp: boolean;
}

export interface ServerErrorRequest {
  id: string;
  method: string;
  route: string | null;
  status: number;
  accountId: AccountId | null;
}

// The server's own failure: an answer it couldn't give, or the process going down with nothing
// to catch it (docs/architecture/errors-and-logs.md, "The server's own errors").
export interface ServerError {
  caughtBy: "request" | "uncaughtException" | "unhandledRejection";
  type: string;
  message: string;
  frames: ServerErrorFrame[];
  request?: ServerErrorRequest;
  at: string;
}

// Where checked client errors, and the server's own, go once they have been logged
// (docs/architecture/errors-and-logs.md).
export interface ErrorSink {
  capture(errors: ClientError[], source: ErrorSource): Promise<void>;
  captureServerError(error: ServerError): Promise<void>;
}
