import type { EventSink } from "./EventSink.js";

export interface PostHogEventSinkOptions {
  apiKey: string;
  host: string;
  environment: string;
  fetch?: typeof fetch | undefined;
  timeoutMs?: number;
}

export class EventDeliveryError extends Error {}

// PostHog over its one batch call, with no SDK: its client would bring a queue and retries
// the request path doesn't want (docs/architecture/analytics.md, "PostHog").
export function createPostHogEventSink({
  apiKey,
  host,
  environment,
  fetch: fetchImpl = globalThis.fetch,
  timeoutMs = 5_000,
}: PostHogEventSinkOptions): EventSink {
  const url = `${host.replace(/\/+$/, "")}/batch/`;
  return {
    capture: async (events, { accountId, context, geoAddress }) => {
      const response = await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          batch: events.map(({ name, props, at }) => ({
            event: name,
            distinct_id: accountId,
            timestamp: at,
            properties: {
              ...props,
              surface: context.surface,
              layout: context.layout,
              app_version: context.appVersion,
              platform: context.platform,
              environment,
              ...(geoAddress === null ? {} : { $ip: geoAddress }),
            },
          })),
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        throw new EventDeliveryError(`PostHog answered ${response.status}`);
      }
    },
  };
}
