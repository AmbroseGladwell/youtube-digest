import { randomUUID } from "node:crypto";
import type { RawRequestDefaultExpression } from "fastify";
import { REQUEST_ID_HEADER, RequestId } from "@overview/domain";

// The client's id when it sent a usable one, so its report of a failure and this server's
// log of it carry the same id; a fresh one otherwise (docs/architecture/api.md, "Request ids").
export function requestIdFor(request: RawRequestDefaultExpression): string {
  const sent = RequestId.safeParse(request.headers[REQUEST_ID_HEADER]);
  return sent.success ? sent.data : randomUUID();
}
