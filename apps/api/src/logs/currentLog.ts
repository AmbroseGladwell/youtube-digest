import { AsyncLocalStorage } from "node:async_hooks";
import type { FastifyBaseLogger, FastifyInstance, FastifyRequest } from "fastify";

const requests = new AsyncLocalStorage<FastifyRequest>();

// Lets code without the request in hand, such as the database client, log under that request.
export const trackCurrentRequest = (app: FastifyInstance): void => {
  app.addHook("onRequest", (request, _reply, done) => {
    requests.run(request, done);
  });
};

export const currentLog = (fallback: FastifyBaseLogger): FastifyBaseLogger => {
  return requests.getStore()?.log ?? fallback;
};
