import type { AnalyticsEventBatch } from "@overview/domain";

// Where the app's analytics go: our own API, which checks each event against the
// catalogue and passes it on (docs/architecture/analytics.md).
export interface EventsApi {
  send(batch: AnalyticsEventBatch, options?: { keepalive?: boolean }): Promise<void>;
}
