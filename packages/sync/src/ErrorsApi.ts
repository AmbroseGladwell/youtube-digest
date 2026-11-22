import type { ClientErrorBatch } from "@overview/domain";

export interface ErrorsApi {
  send(batch: ClientErrorBatch, options?: { keepalive?: boolean }): Promise<void>;
}
