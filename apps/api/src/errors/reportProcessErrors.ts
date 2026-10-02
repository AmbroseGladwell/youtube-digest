import type { EventEmitter } from "node:events";
import type { FastifyBaseLogger } from "fastify";
import type { ErrorSink, ServerError } from "./ErrorSink.js";
import { toServerError } from "./toServerError.js";

export interface ProcessErrorReporting {
  errorSink: ErrorSink | null;
  log: FastifyBaseLogger;
  clock: () => Date;
  // Called once the error has gone or failed to: the process can't be trusted to go on.
  exit: () => void;
  process?: Pick<EventEmitter, "on">;
}

const LOG_MESSAGES = {
  uncaughtException: "uncaught exception",
  unhandledRejection: "unhandled rejection",
} as const;

// What Node does with an error nothing caught, which is stop, but reported before it does
// (docs/architecture/errors-and-logs.md, "The server's own errors").
export function reportProcessErrors({ errorSink, log, clock, exit, process: emitter = process }: ProcessErrorReporting): void {
  let exiting = false;
  const onFatal = (caughtBy: Exclude<ServerError["caughtBy"], "request">) => (error: unknown) => {
    log.fatal({ err: error }, LOG_MESSAGES[caughtBy]);
    if (exiting) return;
    exiting = true;
    const sent =
      errorSink === null
        ? Promise.resolve()
        : errorSink
            .captureServerError(toServerError(error, { caughtBy, at: clock() }))
            .catch((failure: unknown) => log.warn({ error: String(failure) }, "server error not forwarded"));
    void sent.then(exit);
  };
  emitter.on("uncaughtException", onFatal("uncaughtException"));
  emitter.on("unhandledRejection", onFatal("unhandledRejection"));
}
