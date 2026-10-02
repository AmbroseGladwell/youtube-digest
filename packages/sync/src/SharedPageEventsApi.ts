import type { SharedPageEventBatch } from "@overview/domain";

// What a shared link's page tells /api/shares/:token/events, with or without an account
// (docs/architecture/analytics.md, "The shared page").
export interface SharedPageEventsApi {
  send(batch: SharedPageEventBatch, options?: { keepalive?: boolean }): Promise<void>;
}
