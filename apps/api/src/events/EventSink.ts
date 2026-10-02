import type { AnalyticsContext } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";

export interface SinkEvent {
  name: string;
  props: Record<string, string | number | boolean>;
  at: string;
}

export interface EventSource {
  // Null for someone on a shared link with no account, who is told apart by viewId instead.
  accountId: AccountId | null;
  // A shared page's load, made in memory by the page (docs/architecture/analytics.md, "The shared page").
  viewId?: string;
  context: AnalyticsContext;
  // The caller's address cut to its network (geoAddress), for placing events in a country.
  geoAddress: string | null;
}

// Where checked events go once they have been logged. Absent, they are only logged
// (docs/architecture/analytics.md).
export interface EventSink {
  capture(events: SinkEvent[], source: EventSource): Promise<void>;
}
