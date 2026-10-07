import type { FastifyError, FastifyInstance } from "fastify";
import { apiLogLines } from "@overview/domain";
import { isApiError } from "../http/ApiError.js";
import { logRefused } from "../http/logRefused.js";
import { isOAuthError } from "./OAuthError.js";
import { reportRequestError, type RequestErrorReporting } from "../errors/reportRequestError.js";

const isFastifyError = (error: unknown): error is FastifyError =>
  typeof error === "object" && error !== null && "code" in error && "statusCode" in error;

export function registerOAuthErrorHandler(app: FastifyInstance, reporting: RequestErrorReporting): void {
  app.setErrorHandler((error, request, reply) => {
    reply.header("cache-control", "no-store");
    if (isOAuthError(error)) {
      logRefused(request, error.code, error.status);
      if (error.code === "invalid_client") {
        reply.header("www-authenticate", 'Basic realm="oauth"');
      }
      return reply.status(error.status).send({ error: error.code, error_description: error.message });
    }
    if (isApiError(error)) {
      logRefused(request, error.code, error.status, error.details);
      return reply.status(error.status).send({ error: error.code, error_description: error.message });
    }
    if (isFastifyError(error) && error.statusCode !== undefined && error.statusCode < 500) {
      logRefused(request, "invalid_request", 400);
      return reply.status(400).send({ error: "invalid_request", error_description: error.message });
    }
    request.log.error(apiLogLines.http.unhandledError({ err: error, requestId: request.id }));
    reportRequestError(reporting, request, error);
    return reply.status(500).send({ error: "server_error", error_description: "Something went wrong" });
  });
}
