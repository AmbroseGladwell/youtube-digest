import type { FastifyInstance } from "fastify";
import { AnalyticsDeclined, AnalyticsEventBatch, parseAnalyticsEvent, type AnalyticsEvent } from "@overview/domain";
import type { AccountId } from "../auth/AccountId.js";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { SETTINGS_RECORD_ID } from "../records/RecordKind.js";
import type { RecordsRepository } from "../records/RecordsRepository.js";
import { rateLimitHook } from "../rateLimit/rateLimitHook.js";
import { rateLimits } from "../rateLimit/rateLimits.js";
import type { EventSink } from "./EventSink.js";
import { geoAddress } from "./geoAddress.js";

const EVENTS_BODY_LIMIT_BYTES = 32 * 1024;
const DECLINED_BODY_LIMIT_BYTES = 1024;

export interface EventRoutesOptions {
  sink: EventSink | null;
  records: RecordsRepository;
  clock: () => Date;
}

// Signed in, under the session's account unless it turned sharing off; or with no account,
// only when the batch carries the anonymous id the reader agreed to keep
// (docs/features/analytics-consent.md).
export function eventRoutes(app: FastifyInstance, { sink, records, clock }: EventRoutesOptions): void {
  const optedOut = async (accountId: AccountId): Promise<boolean> => {
    const settings = await records.read(accountId, "settings", SETTINGS_RECORD_ID);
    if (settings === null || settings.deleted) return false;
    return (settings.body as { analyticsOptOut?: unknown } | null)?.analyticsOptOut === true;
  };

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
      if (accountId !== null && (await optedOut(accountId))) {
        request.log.info({ events: events.length, surface: context.surface }, "client events dropped for opt-out");
        return reply.status(204).send();
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

  app.post(
    "/events/declined",
    {
      bodyLimit: DECLINED_BODY_LIMIT_BYTES,
      config: { optionalSession: true },
      preHandler: rateLimitHook(rateLimits.anonymousEventsPerAddress, (request) => request.clientAddress, clock),
    },
    async (request, reply) => {
      const { context } = parseOrThrow(AnalyticsDeclined, request.body, "The decline");
      request.log.info({ ...context }, "analytics declined");
      return reply.status(204).send();
    },
  );
}
