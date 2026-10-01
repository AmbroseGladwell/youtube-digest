import type { EventSink } from "./EventSink.js";
import { sendPostHogBatch, type PostHogBatchOptions } from "../postHog/sendPostHogBatch.js";

export interface PostHogEventSinkOptions extends PostHogBatchOptions {
  environment: string;
}

export function createPostHogEventSink({ environment, ...options }: PostHogEventSinkOptions): EventSink {
  return {
    capture: (events, { accountId, context, geoAddress }) =>
      sendPostHogBatch(
        events.map(({ name, props, at }) => ({
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
        options,
      ),
  };
}
