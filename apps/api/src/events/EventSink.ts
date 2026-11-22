import type { AnalyticsContext } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";

export interface SinkEvent {
  name: string;
  props: Record<string, string | number | boolean>;
  at: string;
}

export interface EventSource {
  // Null for a reader with no account, who is told apart by anonymousId or viewId instead.
  accountId: AccountId | null;
  // The id a reader with no account agreed to keep: docs/features/analytics-consent.md, "Three tiers".
  anonymousId?: string;
  // A shared page's load: docs/architecture/analytics.md, "The shared page".
  viewId?: string;
  context: AnalyticsContext;
  geoAddress: string | null;
}

export interface EventSink {
  capture(events: SinkEvent[], source: EventSource): Promise<void>;
  // Ties what a reader shared without an account to the account they just made, once.
  link(accountId: AccountId, anonymousId: string, at: Date): Promise<void>;
}
