import type { FastifyRequest } from "fastify";

// The details a refusal sends that are ids, numbers and enums, never a validation detail,
// which can quote what was sent.
const LOGGED_DETAILS = new Set([
  "kind",
  "rev",
  "overviewId",
  "storedSchemaVersion",
  "clientSchemaVersion",
  "bodySchemaVersion",
  "schemaVersion",
  "minSupportedClientVersion",
  "limit",
  "daily",
  "retryAfterSeconds",
]);

export function logRefused(
  request: FastifyRequest,
  code: string,
  status: number,
  details?: Record<string, unknown>,
): void {
  const logged = Object.fromEntries(Object.entries(details ?? {}).filter(([key]) => LOGGED_DETAILS.has(key)));
  request.log.warn({ code, status, ...logged }, "request refused");
}
