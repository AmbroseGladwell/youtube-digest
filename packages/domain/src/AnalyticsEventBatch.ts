import { z } from "zod";
import { analyticsEventDefinitions, type AnalyticsEventName } from "./analyticsEvents.js";
import { AuthSurface } from "./AuthSurface.js";

export const MAX_ANALYTICS_BATCH_EVENTS = 50;

export const AnalyticsPlatform = z.enum(["macos", "windows", "linux", "chromeos", "android", "ios", "other"]);
export type AnalyticsPlatform = z.infer<typeof AnalyticsPlatform>;

export const AnalyticsContext = z
  .object({
    surface: AuthSurface,
    // "worker" is the extension's service worker, which reports errors and has no screen.
    layout: z.enum(["full", "panel", "worker"]),
    appVersion: z
      .string()
      .regex(/^\d+\.\d+\.\d+$/)
      .nullable(),
    platform: AnalyticsPlatform,
  })
  .strict();
export type AnalyticsContext = z.infer<typeof AnalyticsContext>;

// Shape and size only, so an event a newer client knows about costs only itself (parseAnalyticsEvent).
export const SentAnalyticsEvent = z
  .object({
    name: z.string().max(64),
    // 64 is a model id, the longest a property may be (analyticsEvents.ts, ANALYTICS_IDS).
    props: z.record(z.string().max(32), z.union([z.string().max(64), z.number(), z.boolean()])),
    at: z.iso.datetime(),
  })
  .strict();
export type SentAnalyticsEvent = z.infer<typeof SentAnalyticsEvent>;

const eventBatchShape = {
  context: AnalyticsContext,
  events: z.array(SentAnalyticsEvent).min(1).max(MAX_ANALYTICS_BATCH_EVENTS),
  // The app's own bookkeeping of unsent events, so it is logged and never an event.
  dropped: z.number().int().min(1).max(100_000).optional(),
};

// Only a reader with no account sends an id: docs/features/analytics-consent.md.
export const AnalyticsEventBatch = z
  .object({
    ...eventBatchShape,
    anonymousId: z.uuid().optional(),
  })
  .strict();
export type AnalyticsEventBatch = z.infer<typeof AnalyticsEventBatch>;

// No id, so declines are counted anonymously (docs/features/analytics-consent.md).
export const AnalyticsDeclined = z.object({ context: AnalyticsContext }).strict();
export type AnalyticsDeclined = z.infer<typeof AnalyticsDeclined>;

// The view id lives in memory for one page load: docs/architecture/analytics.md, "The shared page".
export const SharedPageEventBatch = z
  .object({
    ...eventBatchShape,
    viewId: z.uuid(),
  })
  .strict();
export type SharedPageEventBatch = z.infer<typeof SharedPageEventBatch>;

export const SHARED_PAGE_EVENT_PREFIX = "sharedPage.";

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  props: Record<string, string | number | boolean>;
  at: string;
}

export const parseAnalyticsEvent = (sent: SentAnalyticsEvent): AnalyticsEvent | null => {
  const definition = analyticsEventDefinitions.get(sent.name);
  if (definition === undefined) {
    return null;
  }
  const props = z.object(definition.props).strict().safeParse(sent.props);
  if (!props.success) {
    return null;
  }
  const present = Object.entries(props.data).filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined);
  return { name: sent.name as AnalyticsEventName, props: Object.fromEntries(present), at: sent.at };
};

export const parseSharedPageEvent = (sent: SentAnalyticsEvent): AnalyticsEvent | null => {
  return sent.name.startsWith(SHARED_PAGE_EVENT_PREFIX) ? parseAnalyticsEvent(sent) : null;
};
