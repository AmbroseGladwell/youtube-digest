import type { FastifyRequest } from "fastify";
import { apiLogLines } from "@overview/domain";
import type { ErrorSink } from "./ErrorSink.js";
import { toServerError } from "./toServerError.js";

export interface RequestErrorReporting {
  errorSink: ErrorSink | null;
  clock: () => Date;
}

// Only a 500 comes here: docs/architecture/errors-and-logs.md, "The server's own errors".
export const reportRequestError = ({ errorSink, clock }: RequestErrorReporting, request: FastifyRequest, error: unknown): void => {
  if (errorSink === null) {
    return;
  }
  const serverError = toServerError(error, {
    caughtBy: "request",
    request: {
      id: request.id,
      method: request.method,
      route: request.routeOptions?.url ?? null,
      status: 500,
      accountId: request.session?.accountId ?? request.connectionAccess?.accountId ?? null,
    },
    at: clock(),
  });
  void errorSink
    .captureServerError(serverError)
    .catch((failure: unknown) => request.log.warn(apiLogLines.errors.serverErrorNotForwarded({ error: String(failure) })));
};
