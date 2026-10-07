import type { FastifyError, FastifyInstance } from "fastify";
import { apiLogLines, type ApiErrorEnvelope } from "@overview/domain";
import { ApiError, isApiError } from "./ApiError.js";
import { logRefused } from "./logRefused.js";
import { reportRequestError, type RequestErrorReporting } from "../errors/reportRequestError.js";

const envelope = (error: ApiError): ApiErrorEnvelope => ({
  error: {
    code: error.code,
    message: error.message,
    ...(error.details === undefined ? {} : { details: error.details }),
  },
});

const isFastifyError = (error: unknown): error is FastifyError =>
  typeof error === "object" && error !== null && "code" in error && "statusCode" in error;

// One shape for every failure under /api, and nothing about an unexpected error's cause
// reaches the client (docs/architecture/api.md).
export function registerApiErrorHandler(app: FastifyInstance, reporting: RequestErrorReporting): void {
  app.setErrorHandler((error, request, reply) => {
    if (isApiError(error)) {
      logRefused(request, error.code, error.status, error.details);
      return reply.status(error.status).send(envelope(error));
    }
    if (isFastifyError(error) && error.statusCode !== undefined && error.statusCode < 500) {
      logRefused(request, "invalid_request", 400);
      return reply
        .status(400)
        .send(envelope(new ApiError("invalid_request", error.message)));
    }
    request.log.error(apiLogLines.http.unhandledError({ err: error, requestId: request.id }));
    reportRequestError(reporting, request, error);
    return reply.status(500).send(envelope(new ApiError("internal_error", "Something went wrong")));
  });

  app.setNotFoundHandler((request, reply) =>
    reply
      .status(404)
      .send(envelope(new ApiError("not_found", `No route for ${request.method} ${request.url}`))),
  );
}
