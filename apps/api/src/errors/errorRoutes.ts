import type { FastifyInstance } from "fastify";
import { ClientErrorBatch, readClientError } from "@overview/domain";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { rateLimitHook } from "../rateLimit/rateLimitHook.js";
import { rateLimits } from "../rateLimit/rateLimits.js";
import { geoAddress } from "../events/geoAddress.js";
import type { ErrorSink } from "./ErrorSink.js";

const ERRORS_BODY_LIMIT_BYTES = 64 * 1024;

// With or without an account: an error is operational, not usage
// (docs/architecture/errors-and-logs.md, "Who is reported").
export function errorRoutes(app: FastifyInstance, sink: ErrorSink | null, clock: () => Date): void {
  app.post(
    "/errors",
    {
      bodyLimit: ERRORS_BODY_LIMIT_BYTES,
      config: { optionalSession: true },
      preHandler: rateLimitHook(rateLimits.errorsPerAddress, (request) => request.clientAddress, clock),
    },
    async (request, reply) => {
      const { context, errors: sent, dropped } = parseOrThrow(ClientErrorBatch, request.body, "The errors");
      const errors = sent.map(readClientError);

      for (const { source, type, message, handled, frames, requestId, apiErrorCode, status, trail } of errors) {
        request.log.warn(
          {
            clientError: { source, type, message, handled, top: frames[0], apiErrorCode, status },
            failedRequestId: requestId,
            trail: trail.map(({ name }) => name),
            signedIn: request.session !== null,
            ...context,
          },
          "client error",
        );
      }
      if (dropped !== undefined) {
        request.log.warn({ dropped, surface: context.surface, appVersion: context.appVersion }, "client errors dropped");
      }
      if (sink !== null) {
        const source = {
          accountId: request.session?.accountId ?? null,
          context,
          geoAddress: geoAddress(request.clientAddress),
        };
        void sink
          .capture(errors, source)
          .catch((error: unknown) =>
            request.log.warn({ errors: errors.length, error: String(error) }, "client errors not forwarded"),
          );
      }
      return reply.status(204).send();
    },
  );
}
