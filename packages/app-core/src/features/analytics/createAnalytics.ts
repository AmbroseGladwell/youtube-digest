import {
  analyticsEvents,
  type AnalyticsCatalogue,
  type AnalyticsEventName,
  type AnalyticsEventPropsOf,
} from "@overview/domain";
import type { AnalyticsQueue, SendOptions } from "./AnalyticsQueue.js";

type EventMethod<Definition> =
  keyof AnalyticsEventPropsOf<Definition> extends never
    ? () => void
    : (props: AnalyticsEventPropsOf<Definition>) => void;

// The queue's own bookkeeping is in the catalogue so the server can check it, but only the
// queue sends it.
type Area = Exclude<keyof AnalyticsCatalogue, "analytics">;

export type Analytics = {
  [A in Area]: { [E in keyof AnalyticsCatalogue[A]]: EventMethod<AnalyticsCatalogue[A][E]> };
} & {
  flush(options?: SendOptions): Promise<void>;
};

export type AnalyticsRecorder = Pick<AnalyticsQueue, "record" | "flush">;

// analytics.consent.approved(): one method per event in the catalogue, grouped by where in
// the app it happens, so a call site can only name an event that exists with the
// properties it declares (docs/architecture/analytics.md, "Adding an event").
export function createAnalytics(recorder: AnalyticsRecorder): Analytics {
  const areas = Object.entries(analyticsEvents)
    .filter(([area]) => area !== "analytics")
    .map(([area, events]) => [
      area,
      Object.fromEntries(
        Object.keys(events).map((event) => [
          event,
          (props: Record<string, string | number | boolean> = {}) =>
            recorder.record(`${area}.${event}` as AnalyticsEventName, props),
        ]),
      ),
    ]);
  return {
    ...(Object.fromEntries(areas) as Omit<Analytics, "flush">),
    flush: (options) => recorder.flush(options),
  };
}

export const silentAnalytics: Analytics = createAnalytics({ record: () => {}, flush: async () => {} });
