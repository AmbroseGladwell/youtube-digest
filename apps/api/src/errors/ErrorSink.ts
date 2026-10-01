import type { AnalyticsContext, ClientError } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";

export interface ErrorSource {
  // Null for a reader with no account: an error is reported whether or not they can be counted.
  accountId: AccountId | null;
  context: AnalyticsContext;
  geoAddress: string | null;
}

// Where checked client errors go once they have been logged (docs/architecture/errors-and-logs.md).
export interface ErrorSink {
  capture(errors: ClientError[], source: ErrorSource): Promise<void>;
}
