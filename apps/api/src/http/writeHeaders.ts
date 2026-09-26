import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
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

export interface WrittenRecord {
  id: string;
  rev: number;
  seq: number;
}

export function sendWritten(reply: FastifyReply, written: WrittenRecord, status: 200 | 201 = 200) {
  const { id, rev, seq } = written;
  return reply.status(status).header("etag", `"${rev}"`).send({ id, rev, seq });
}
