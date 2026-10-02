import type { FastifyError, FastifyInstance } from "fastify";
import type { ApiErrorEnvelope } from "@overview/domain";
import { ApiError, isApiError } from "./ApiError.js";
import { reportRequestError, type RequestErrorReporting } from "../errors/reportRequestError.js";

const envelope = (error: ApiError): ApiErrorEnvelope => ({
  error: {
    code: error.code,
    message: error.message,
    ...(error.details === undefined ? {} : { details: error.details }),
  },
});

// The details a refusal sends that are ids, numbers and enums, never a validation detail,
// which can quote what was sent.
const LOGGED_DETAILS = new Set([
  "kind",
  "rev",
  "storedSchemaVersion",
  "clientSchemaVersion",
  "bodySchemaVersion",
  "schemaVersion",
  "minSupportedClientVersion",
  "limit",
]);

const loggedDetails = (details: Record<string, unknown> | undefined) =>
  Object.fromEntries(Object.entries(details ?? {}).filter(([key]) => LOGGED_DETAILS.has(key)));

const isFastifyError = (error: unknown): error is FastifyError =>
  typeof error === "object" && error !== null && "code" in error && "statusCode" in error;

// One shape for every failure under /api, and nothing about an unexpected error's cause
// reaches the client (docs/architecture/api.md).
export function registerApiErrorHandler(app: FastifyInstance, reporting: RequestErrorReporting): void {
  app.setErrorHandler((error, request, reply) => {
    if (isApiError(error)) {
      request.log.warn({ code: error.code, status: error.status, ...loggedDetails(error.details) }, "request refused");
      return reply.status(error.status).send(envelope(error));
    }
    if (isFastifyError(error) && error.statusCode !== undefined && error.statusCode < 500) {
      request.log.warn({ code: "invalid_request", status: 400 }, "request refused");
      return reply
        .status(400)
        .send(envelope(new ApiError("invalid_request", error.message)));
    }
    request.log.error({ err: error, requestId: request.id }, "unhandled error");
    reportRequestError(reporting, request, error);
    return reply.status(500).send(envelope(new ApiError("internal_error", "Something went wrong")));
  });

  app.setNotFoundHandler((request, reply) =>
    reply
      .status(404)
      .send(envelope(new ApiError("not_found", `No route for ${request.method} ${request.url}`))),
  );
}
