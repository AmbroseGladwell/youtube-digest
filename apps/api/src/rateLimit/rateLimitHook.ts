import type { FastifyReply, FastifyRequest } from "fastify";
import { ApiError } from "../http/ApiError.js";
import { FixedWindowLimiter } from "./FixedWindowLimiter.js";
import type { RateLimit } from "./RateLimit.js";

export type RateLimitKey = (request: FastifyRequest) => string | null;

// A request with no key is not counted by this limit: an unauthenticated request has no
// account, and a malformed body has no address to count against (docs/architecture/api.md).
export function rateLimitHook(rateLimit: RateLimit, keyOf: RateLimitKey, clock: () => Date) {
  const limiter = new FixedWindowLimiter(rateLimit);
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const key = keyOf(request);
    if (key === null) {
      return;
    }
    const verdict = limiter.take(key, clock());
    if (verdict.allowed) {
      return;
    }
    const { retryAfterSeconds } = verdict;
    request.log.warn(
      { limit: rateLimit.name, method: request.method, route: request.routeOptions.url ?? null, retryAfterSeconds },
      "throttled",
    );
    reply.header("retry-after", String(retryAfterSeconds));
    throw new ApiError("too_many_requests", "Too many requests. Try again shortly", { retryAfterSeconds });
  };
}
