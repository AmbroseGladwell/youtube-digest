import type { FastifyReply, FastifyRequest } from "fastify";

export type LogContext = Record<string, string | number>;

// Fastify writes "request completed" through the reply's logger, so it gets the context too.
export const bindLogContext = (request: FastifyRequest, reply: FastifyReply, context: LogContext): void => {
  request.log = request.log.child(context);
  reply.log = request.log;
};
