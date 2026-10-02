import type { FastifyInstance } from "fastify";
import { SharedPageEventBatch, ShareToken, parseSharedPageEvent, type AnalyticsEvent } from "@overview/domain";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { rateLimitHook } from "../rateLimit/rateLimitHook.js";
import { rateLimits } from "../rateLimit/rateLimits.js";
import type { SharesRepository } from "../shares/SharesRepository.js";
import type { EventSink } from "./EventSink.js";
import { geoAddress } from "./geoAddress.js";

const SHARED_PAGE_EVENTS_BODY_LIMIT_BYTES = 32 * 1024;

// With or without an account, and only sharedPage.* events. The token never leaves this
// handler: the overview it names is added to each event instead (docs/architecture/analytics.md,
// "The shared page").
export function sharedPageEventRoutes(
  app: FastifyInstance,
  { shares, sink, clock }: { shares: SharesRepository; sink: EventSink | null; clock: () => Date },
): void {
  app.post<{ Params: { token: string } }>(
    "/shares/:token/events",
    {
      bodyLimit: SHARED_PAGE_EVENTS_BODY_LIMIT_BYTES,
      config: { optionalSession: true },
      preHandler: rateLimitHook(rateLimits.sharedPageEventsPerAddress, (request) => request.clientAddress, clock),
    },
    async (request, reply) => {
      const { context, viewId, events, dropped } = parseOrThrow(SharedPageEventBatch, request.body, "The events");
      const token = ShareToken.safeParse(request.params.token);
      const share = token.success ? await shares.overviewFor(token.data) : null;
      const accepted = events
        .map(parseSharedPageEvent)
        .filter((event): event is AnalyticsEvent => event !== null)
        .map((event) => (share === null ? event : { ...event, props: { ...event.props, overviewId: share.overviewId } }));
      const refused = events.length - accepted.length;
      const signedIn = request.session !== null;

      for (const { name, props } of accepted) {
        request.log.info({ event: name, props, viewId, signedIn, ...context }, "client event");
      }
      if (dropped !== undefined) {
        request.log.warn({ dropped, surface: context.surface, appVersion: context.appVersion }, "client events dropped");
      }
      if (refused > 0) {
        request.log.warn({ refused, surface: context.surface, appVersion: context.appVersion }, "client events refused");
      }
      if (sink !== null && accepted.length > 0) {
        const source = {
          accountId: request.session?.accountId ?? null,
          viewId,
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
