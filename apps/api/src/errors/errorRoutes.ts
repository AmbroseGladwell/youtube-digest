import type { FastifyInstance } from "fastify";
import { apiLogLines, ClientErrorBatch, readClientError, readClientWarning } from "@overview/domain";
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
      const { context, errors: sent, warnings = [], dropped } = parseOrThrow(ClientErrorBatch, request.body, "The errors");
      const errors = sent.map(readClientError);

      for (const { source, type, message, handled, frames, requestId, apiErrorCode, status, trail } of errors) {
        request.log.warn(
          apiLogLines.errors.clientError({
            clientError: { source, type, message, handled, top: frames[0], apiErrorCode, status },
            failedRequestId: requestId,
            trail: trail.map(({ name }) => name),
            signedIn: request.session !== null,
            ...context,
          }),
        );
      }
      // Logged and nothing more: a degraded moment the app carried on through is the
      // system's story, not an issue to triage (docs/architecture/errors-and-logs.md, "Client warnings").
      for (const { at: _at, ...warning } of warnings.map(readClientWarning)) {
        const { requestId, ...logged } = "requestId" in warning ? warning : { ...warning, requestId: undefined };
        request.log.warn(
          apiLogLines.errors.clientWarning({
            clientWarning: logged,
            failedRequestId: requestId,
            signedIn: request.session !== null,
            ...context,
          }),
        );
      }
      if (dropped !== undefined) {
        request.log.warn(apiLogLines.errors.clientErrorsDropped({ dropped, surface: context.surface, appVersion: context.appVersion }));
      }
      if (sink !== null && errors.length > 0) {
        const source = {
          accountId: request.session?.accountId ?? null,
          context,
          geoAddress: geoAddress(request.clientAddress),
        };
        void sink
          .capture(errors, source)
          .catch((error: unknown) =>
            request.log.warn(apiLogLines.errors.clientErrorsNotForwarded({ errors: errors.length, error: String(error) })),
          );
      }
      return reply.status(204).send();
    },
  );
}
