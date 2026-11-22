import { randomUUID } from "node:crypto";
import type { RawRequestDefaultExpression } from "fastify";
import { REQUEST_ID_HEADER, RequestId } from "@overview/domain";

// Why the client's id: docs/architecture/api.md, "Request ids".
export const requestIdFor = (request: RawRequestDefaultExpression): string => {
  const sent = RequestId.safeParse(request.headers[REQUEST_ID_HEADER]);
  return sent.success ? sent.data : randomUUID();
};
