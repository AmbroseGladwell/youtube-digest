import type { AnalyticsContext } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";

export interface SinkEvent {
  name: string;
  props: Record<string, string | number | boolean>;
  at: string;
}

// Where an event came from: the app, which says what it is in a context of its own, or an
// assistant over /mcp, which the server observes and the app never sees.
export type EventOrigin = { kind: "app"; context: AnalyticsContext } | { kind: "mcp" };

export interface EventSource {
  accountId: AccountId;
  origin: EventOrigin;
  // The caller's address cut to its network (geoAddress), for placing events in a country.
  geoAddress: string | null;
}

// Where checked events go once they have been logged. Absent, they are only logged
// (docs/architecture/analytics.md).
export interface EventSink {
  capture(events: SinkEvent[], source: EventSource): Promise<void>;
}
