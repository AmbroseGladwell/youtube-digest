import { AsyncLocalStorage } from "node:async_hooks";
import type { FastifyBaseLogger, FastifyInstance, FastifyRequest } from "fastify";

const requests = new AsyncLocalStorage<FastifyRequest>();

// Code that has no request in hand, such as the database client, still logs under the
// request it is working for, with its reqId and whatever bindLogContext has added since.
export function trackCurrentRequest(app: FastifyInstance): void {
  app.addHook("onRequest", (request, _reply, done) => {
    requests.run(request, done);
  });
}

export function currentLog(fallback: FastifyBaseLogger): FastifyBaseLogger {
  return requests.getStore()?.log ?? fallback;
}
