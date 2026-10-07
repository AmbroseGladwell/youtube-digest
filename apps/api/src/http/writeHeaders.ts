import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { logRecordWritten } from "../records/logRecordWritten.js";
import type { WriteOutcome } from "../records/RecordsRepository.js";
import { ApiError } from "./ApiError.js";

const IF_MATCH = /^"?([1-9]\d*)"?$/;

export function ifMatchOf(request: FastifyRequest): number | null {
  const header = request.headers["if-match"];
  if (header === undefined) {
    return null;
  }
  const match = Array.isArray(header) ? null : IF_MATCH.exec(header);
  if (match === null) {
    throw new ApiError("invalid_request", "If-Match must be one revision number");
  }
  return Number(match[1]);
}

export const UpdatedAt = z.iso.datetime({ offset: true }).transform((value) => new Date(value).toISOString());

export function sendWritten(reply: FastifyReply, written: WriteOutcome, status: 200 | 201 = 200) {
  logRecordWritten(reply.request.log, written);
  return reply.status(status).header("etag", `"${written.rev}"`).send({ id: written.id, rev: written.rev, seq: written.seq });
}
