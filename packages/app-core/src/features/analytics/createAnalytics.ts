import {
  analyticsEvents,
  type AnalyticsCatalogue,
  type AnalyticsEventName,
  type AnalyticsEventPropsOf,
} from "@overview/domain";
import type { AnalyticsQueue, SendOptions } from "./AnalyticsQueue.js";

export type EventMethod<Definition> =
  keyof AnalyticsEventPropsOf<Definition> extends never
    ? () => void
    : (props: AnalyticsEventPropsOf<Definition>) => void;

type Feature = keyof AnalyticsCatalogue;

export type Analytics = {
  [F in Feature]: {
    [S in keyof AnalyticsCatalogue[F]]: {
      [A in keyof AnalyticsCatalogue[F][S]]: EventMethod<AnalyticsCatalogue[F][S][A]>;
    };
  };
} & {
  flush(options?: SendOptions): Promise<void>;
};

export type AnalyticsRecorder = Pick<AnalyticsQueue, "record" | "flush">;

type Props = Record<string, string | number | boolean>;

// analytics.mcp.consentScreen.approved(): one method per event in the catalogue, by feature,
// then screen, then action, so a call site can only name an event that exists with the
// properties it declares (docs/architecture/analytics.md, "Adding an event").
export function createAnalytics(recorder: AnalyticsRecorder): Analytics {
  const methodsFor = (feature: string, screen: string, events: object) =>
    Object.fromEntries(
      Object.keys(events).map((action) => [
        action,
        (props: Props = {}) => recorder.record(`${feature}.${screen}.${action}` as AnalyticsEventName, props),
      ]),
    );
  const features = Object.entries(analyticsEvents).map(([feature, screens]) => [
    feature,
    Object.fromEntries(Object.entries(screens).map(([screen, events]) => [screen, methodsFor(feature, screen, events)])),
  ]);
  return {
    ...(Object.fromEntries(features) as Omit<Analytics, "flush">),
    flush: (options) => recorder.flush(options),
  };
}

export const silentAnalytics: Analytics = createAnalytics({ record: () => {}, flush: async () => {} });
