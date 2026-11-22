import type { SharedPageEventBatch } from "@overview/domain";

export interface SharedPageEventsApi {
  send(batch: SharedPageEventBatch, options?: { keepalive?: boolean }): Promise<void>;
}
