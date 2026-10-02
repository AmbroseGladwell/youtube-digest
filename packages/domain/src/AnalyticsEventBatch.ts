import { z } from "zod";
import { analyticsEventDefinitions, type AnalyticsEventName } from "./analyticsEvents.js";
import { AuthSurface } from "./AuthSurface.js";

export const MAX_ANALYTICS_BATCH_EVENTS = 50;

export const AnalyticsPlatform = z.enum(["macos", "windows", "linux", "chromeos", "android", "ios", "other"]);
export type AnalyticsPlatform = z.infer<typeof AnalyticsPlatform>;

// Said once per batch rather than on every event: what every event in it has in common.
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

// The envelope checks shape and size only; whether a name is in the catalogue and its
// properties are the ones it declares is parseAnalyticsEvent's job, one event at a time,
// so an event a newer client knows about costs only itself.
export const SentAnalyticsEvent = z
  .object({
    name: z.string().max(64),
    // 36 is a uuid, the longest a property may be (analyticsEvents.ts, ANALYTICS_IDS).
    props: z.record(z.string().max(32), z.union([z.string().max(36), z.number(), z.boolean()])),
    at: z.iso.datetime(),
  })
  .strict();
export type SentAnalyticsEvent = z.infer<typeof SentAnalyticsEvent>;

export const AnalyticsEventBatch = z
  .object({
    context: AnalyticsContext,
    events: z.array(SentAnalyticsEvent).min(1).max(MAX_ANALYTICS_BATCH_EVENTS),
    // How many events the app couldn't send or hold since its last batch got through. The
    // app's own bookkeeping, so it is logged and never an event.
    dropped: z.number().int().min(1).max(100_000).optional(),
  })
  .strict();
export type AnalyticsEventBatch = z.infer<typeof AnalyticsEventBatch>;

// From a shared link, with or without an account. The view id is made for the page load and
// held in memory, so one visit's events read together and nothing is kept on the device
// (docs/architecture/analytics.md, "The shared page").
export const SharedPageEventBatch = z
  .object({
    ...AnalyticsEventBatch.shape,
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

export function parseAnalyticsEvent(sent: SentAnalyticsEvent): AnalyticsEvent | null {
  const definition = analyticsEventDefinitions.get(sent.name);
  if (definition === undefined) return null;
  const props = z.object(definition.props).strict().safeParse(sent.props);
  return props.success ? { name: sent.name as AnalyticsEventName, props: props.data, at: sent.at } : null;
}

export function parseSharedPageEvent(sent: SentAnalyticsEvent): AnalyticsEvent | null {
  return sent.name.startsWith(SHARED_PAGE_EVENT_PREFIX) ? parseAnalyticsEvent(sent) : null;
}
