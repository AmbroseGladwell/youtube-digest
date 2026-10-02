import type { FastifyError, FastifyInstance } from "fastify";
import { isApiError } from "../http/ApiError.js";
import { logRefused } from "../http/logRefused.js";
import { JSON_RPC_ERRORS, jsonRpcError } from "./handleMcpMessage.js";
import { reportRequestError, type RequestErrorReporting } from "../errors/reportRequestError.js";

const isFastifyError = (error: unknown): error is FastifyError =>
  typeof error === "object" && error !== null && "code" in error && "statusCode" in error;

export function registerMcpErrorHandler(app: FastifyInstance, reporting: RequestErrorReporting): void {
  app.setErrorHandler((error, request, reply) => {
    if (isApiError(error)) {
      logRefused(request, error.code, error.status, error.details);
      return reply.status(error.status).send({ error: error.code, error_description: error.message });
    }
    if (isFastifyError(error) && error.statusCode !== undefined && error.statusCode < 500) {
      const code = error.statusCode === 400 ? JSON_RPC_ERRORS.parseError : JSON_RPC_ERRORS.invalidRequest;
      logRefused(request, "invalid_request", error.statusCode);
      return reply.status(error.statusCode).send(jsonRpcError(null, code, error.message));
    }
    request.log.error({ err: error, requestId: request.id }, "unhandled error");
    reportRequestError(reporting, request, error);
    return reply.status(500).send(jsonRpcError(null, JSON_RPC_ERRORS.internalError, "Something went wrong"));
  });
}
