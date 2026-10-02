import type { FastifyReply, FastifyRequest } from "fastify";

export type LogContext = Record<string, string | number>;

// Every later line for the request carries these, its "request completed" line included,
// which Fastify writes through the reply's logger.
export function bindLogContext(request: FastifyRequest, reply: FastifyReply, context: LogContext): void {
  request.log = request.log.child(context);
  reply.log = request.log;
}
