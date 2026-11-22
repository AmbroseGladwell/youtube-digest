import { multistream, pino, type DestinationStream, type Logger } from "pino";
import type { FastifyReply, FastifyRequest } from "fastify";
import { redactErrorMessage } from "@overview/domain";

// Never the path, query or address: docs/architecture/errors-and-logs.md, "What a log line may carry".
export const requestLogSerializers = {
  req: (request: FastifyRequest) => ({
    method: request.method,
    route: request.routeOptions?.url ?? null,
  }),
  res: (reply: FastifyReply) => ({ statusCode: reply.statusCode }),
  // pino copies every field, and a database error's detail quotes the refused row, so only these are kept.
  err: (error: unknown) => {
    if (!(error instanceof Error)) {
      return { message: redactErrorMessage(String(error)) };
    }
    const code = (error as { code?: unknown }).code;
    return {
      type: error.constructor.name,
      message: redactErrorMessage(error.message),
      ...(typeof code === "string" ? { code } : {}),
      stack: error.stack?.split("\n").slice(1).join("\n"),
    };
  },
};

export const SERVICE_NAME = "overview-api";

export const createLogger = (destinations: DestinationStream[]): Logger => {
  return pino(
    { level: "info", base: { service: SERVICE_NAME }, serializers: requestLogSerializers },
    multistream(destinations.map((stream) => ({ stream }))),
  );
};
