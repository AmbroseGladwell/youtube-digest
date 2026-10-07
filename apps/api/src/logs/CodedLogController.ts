import { LogController } from "fastify";
import type { FastifyBaseLogger, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { apiLogLines } from "@overview/domain";

// Fastify writes a dozen lines of its own, several of them named by an error's message.
// Every one is replaced here by a line from the catalogue, so nothing reaches PostHog
// without a code (docs/architecture/errors-and-logs.md, "Logging codes").
export class CodedLogController extends LogController {
  incomingRequest(request: FastifyRequest): void {
    if (this.isLogDisabled(request)) return;
    request.log.info(apiLogLines.http.requestReceived({ req: request }));
  }

  requestCompleted(error: Error | null | undefined, request: FastifyRequest, reply: FastifyReply): void {
    if (this.isLogDisabled(request)) return;
    const responseTime = reply.elapsedTime;
    if (error) {
      reply.log.error(apiLogLines.http.requestErrored({ res: reply, err: error, responseTime }));
    } else {
      reply.log.info(apiLogLines.http.requestCompleted({ res: reply, responseTime }));
    }
  }

  defaultErrorLog(error: Error, request: FastifyRequest, reply: FastifyReply): void {
    if (this.isLogDisabled(request)) return;
    reply.log.error(apiLogLines.http.errorHandled({ req: request, res: reply, err: error }));
  }

  streamError(error: Error & { code?: string }, request: FastifyRequest, reply: FastifyReply): void {
    if (this.isLogDisabled(request)) return;
    if (error.code === "ERR_STREAM_PREMATURE_CLOSE") {
      reply.log.info(apiLogLines.http.streamClosedPrematurely({ res: reply }));
    } else {
      reply.log.warn(apiLogLines.http.responseTerminated({ err: error }));
    }
  }

  // Never the path: it can hold a share token or a video id
  // (docs/architecture/errors-and-logs.md, "What a log line may carry").
  routeNotFound(request: FastifyRequest, reply: FastifyReply): void {
    if (this.isLogDisabled(request)) return;
    request.log.info(apiLogLines.http.routeNotFound({ method: request.raw.method ?? null }));
  }

  writeHeadError(error: Error, request: FastifyRequest, reply: FastifyReply): void {
    if (this.isLogDisabled(request)) return;
    reply.log.warn(apiLogLines.http.writeHeadFailed({ req: request, res: reply, err: error }));
  }

  serializerError(error: Error, request: FastifyRequest, reply: FastifyReply, metadata: { statusCode: number }): void {
    if (this.isLogDisabled(request)) return;
    reply.log.error(apiLogLines.http.serializerFailed({ err: error, statusCode: metadata.statusCode }));
  }

  serviceUnavailable(logger: FastifyBaseLogger, _server: FastifyInstance): void {
    logger.info(apiLogLines.http.serverClosing({ res: { statusCode: 503 } }));
  }
}
