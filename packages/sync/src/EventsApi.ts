import type { AnalyticsContext, AnalyticsEventBatch } from "@overview/domain";

// Where the app's analytics go: our own API, which checks each event against the
// catalogue and passes it on (docs/architecture/analytics.md).
export interface EventsApi {
  send(batch: AnalyticsEventBatch, options?: { keepalive?: boolean }): Promise<void>;
  // A reader without an account saying no, counted with no id
  // (docs/features/analytics-consent.md).
  declined(context: AnalyticsContext): Promise<void>;
}
