import type { FastifyReply, FastifyRequest } from "fastify";
import { apiLogLines } from "@overview/domain";
import { ApiError } from "../http/ApiError.js";
import { FixedWindowLimiter } from "./FixedWindowLimiter.js";
import type { RateLimit } from "./RateLimit.js";

export type RateLimitKey = (request: FastifyRequest) => string | null;

// No key, no count: an unauthenticated request has no account, and a malformed body no address.
export const rateLimitHook = (rateLimit: RateLimit, keyOf: RateLimitKey, clock: () => Date) => {
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
      apiLogLines.http.throttled({
        limit: rateLimit.name,
        method: request.method,
        route: request.routeOptions.url ?? null,
        retryAfterSeconds,
      }),
    );
    reply.header("retry-after", String(retryAfterSeconds));
    throw new ApiError("too_many_requests", "Too many requests. Try again shortly", { retryAfterSeconds });
  };
};
