import type { FastifyError, FastifyInstance } from "fastify";
import { isApiError } from "../http/ApiError.js";
import { isOAuthError } from "./OAuthError.js";

const isFastifyError = (error: unknown): error is FastifyError =>
  typeof error === "object" && error !== null && "code" in error && "statusCode" in error;

export function registerOAuthErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    reply.header("cache-control", "no-store");
    if (isOAuthError(error)) {
      if (error.code === "invalid_client") {
        reply.header("www-authenticate", 'Basic realm="oauth"');
      }
      return reply.status(error.status).send({ error: error.code, error_description: error.message });
    }
    if (isApiError(error)) {
      return reply.status(error.status).send({ error: error.code, error_description: error.message });
    }
    if (isFastifyError(error) && error.statusCode !== undefined && error.statusCode < 500) {
      return reply.status(400).send({ error: "invalid_request", error_description: error.message });
    }
    request.log.error({ err: error, requestId: request.id }, "unhandled error");
    return reply.status(500).send({ error: "server_error", error_description: "Something went wrong" });
  });
}
