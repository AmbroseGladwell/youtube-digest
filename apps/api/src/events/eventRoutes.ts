import type { FastifyInstance } from "fastify";
import { AnalyticsEventBatch, parseAnalyticsEvent, type AnalyticsEvent } from "@overview/domain";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { rateLimitHook } from "../rateLimit/rateLimitHook.js";
import { rateLimits } from "../rateLimit/rateLimits.js";
import type { EventSink } from "./EventSink.js";
import { geoAddress } from "./geoAddress.js";

const EVENTS_BODY_LIMIT_BYTES = 32 * 1024;

// Signed in, under the session's account; or with no account, only when the batch carries
// the anonymous id the reader agreed to keep (docs/features/analytics-consent.md).
export function eventRoutes(app: FastifyInstance, sink: EventSink | null, clock: () => Date): void {
  app.post(
    "/events",
    {
      bodyLimit: EVENTS_BODY_LIMIT_BYTES,
      config: { optionalSession: true },
      preHandler: [
        rateLimitHook(rateLimits.eventsPerAccount, (request) => request.session?.accountId ?? null, clock),
        rateLimitHook(
          rateLimits.anonymousEventsPerAddress,
          (request) => (request.session === null ? request.clientAddress : null),
          clock,
        ),
      ],
    },
    async (request, reply) => {
      const { context, events, dropped, anonymousId } = parseOrThrow(AnalyticsEventBatch, request.body, "The events");
      const accountId = request.session?.accountId ?? null;
      if (accountId === null && anonymousId === undefined) {
        throw new ApiError("unauthenticated", "Sign in, or agree to share usage, to send events");
      }
      const accepted = events.map(parseAnalyticsEvent).filter((event): event is AnalyticsEvent => event !== null);
      const refused = events.length - accepted.length;

      for (const { name, props } of accepted) {
        request.log.info({ event: name, props, signedIn: accountId !== null, ...context }, "client event");
      }
      if (dropped !== undefined) {
        request.log.warn({ dropped, surface: context.surface, appVersion: context.appVersion }, "client events dropped");
      }
      if (refused > 0) {
        request.log.warn({ refused, surface: context.surface, appVersion: context.appVersion }, "client events refused");
      }
      if (sink !== null && accepted.length > 0) {
        const source = {
          accountId,
          ...(accountId === null && anonymousId !== undefined ? { anonymousId } : {}),
          context,
          geoAddress: geoAddress(request.clientAddress),
        };
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
