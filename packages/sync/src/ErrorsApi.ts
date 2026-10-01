import type { ClientErrorBatch } from "@overview/domain";

// Where the app's errors go: our own API, with or without a session
// (docs/architecture/errors-and-logs.md).
export interface ErrorsApi {
  send(batch: ClientErrorBatch, options?: { keepalive?: boolean }): Promise<void>;
}
