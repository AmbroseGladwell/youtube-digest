import type { FastifyInstance } from "fastify";
import { AnalyticsEventBatch, parseAnalyticsEvent, type AnalyticsEvent } from "@overview/domain";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { rateLimitHook } from "../rateLimit/rateLimitHook.js";
import { rateLimits } from "../rateLimit/rateLimits.js";
import type { EventSink } from "./EventSink.js";
import { geoAddress } from "./geoAddress.js";

const EVENTS_BODY_LIMIT_BYTES = 32 * 1024;

// Signed in only: usage from a reader with no account waits for their consent
// (docs/architecture/analytics.md, "Who is counted").
export function eventRoutes(app: FastifyInstance, sink: EventSink | null, clock: () => Date): void {
  app.post(
    "/events",
    {
      bodyLimit: EVENTS_BODY_LIMIT_BYTES,
      preHandler: rateLimitHook(rateLimits.eventsPerAccount, (request) => request.session?.accountId ?? null, clock),
    },
    async (request, reply) => {
      const { context, events, dropped } = parseOrThrow(AnalyticsEventBatch, request.body, "The events");
      const accepted = events.map(parseAnalyticsEvent).filter((event): event is AnalyticsEvent => event !== null);
      const refused = events.length - accepted.length;

      for (const { name, props } of accepted) {
        request.log.info({ event: name, props, ...context }, "client event");
      }
      if (dropped !== undefined) {
        request.log.warn({ dropped, surface: context.surface, appVersion: context.appVersion }, "client events dropped");
      }
      if (refused > 0) {
        request.log.warn({ refused, surface: context.surface, appVersion: context.appVersion }, "client events refused");
      }
      if (sink !== null && accepted.length > 0) {
        const source = {
          accountId: request.session!.accountId,
          context,
          geoAddress: geoAddress(request.clientAddress),
        } as const;
        void sink
          .capture(accepted, source)
          .catch((error: unknown) =>
            request.log.warn({ events: accepted.length, error: String(error) }, "client events not forwarded"),
          );
      }
      return reply.status(204).send();
    },
  );
}
