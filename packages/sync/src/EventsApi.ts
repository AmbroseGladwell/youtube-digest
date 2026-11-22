import type { AnalyticsContext, AnalyticsEventBatch } from "@overview/domain";

export interface EventsApi {
  send(batch: AnalyticsEventBatch, options?: { keepalive?: boolean }): Promise<void>;
  // A reader without an account saying no, counted with no id.
  declined(context: AnalyticsContext): Promise<void>;
}
