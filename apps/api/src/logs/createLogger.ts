import { multistream, pino, type DestinationStream, type Logger } from "pino";
import type { FastifyReply, FastifyRequest } from "fastify";

// A request is logged by its route, never its address: a path can hold a share token or a
// video id and a query an OAuth state, and the caller's IP address is never logged, as the
// rate limits already promise (docs/architecture/errors-and-logs.md, "What a log line may carry").
export const requestLogSerializers = {
  req: (request: FastifyRequest) => ({
    method: request.method,
    route: request.routeOptions?.url ?? null,
  }),
  res: (reply: FastifyReply) => ({ statusCode: reply.statusCode }),
};

export function createLogger(destinations: DestinationStream[]): Logger {
  return pino(
    { level: "info", serializers: requestLogSerializers },
    multistream(destinations.map((stream) => ({ stream }))),
  );
}
