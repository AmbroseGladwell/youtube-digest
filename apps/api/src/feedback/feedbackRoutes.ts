import type { FastifyInstance } from "fastify";
import { apiLogLines, FEEDBACK_PATH, FeedbackRequest, isAnalyticsEventName, redactFeedbackText } from "@overview/domain";
import { accountPlan } from "../auth/accountPlan.js";
import type { SqlClient } from "../db/SqlClient.js";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { rateLimitHook } from "../rateLimit/rateLimitHook.js";
import { rateLimits } from "../rateLimit/rateLimits.js";
import { FeedbackRepository } from "./FeedbackRepository.js";

const FEEDBACK_BODY_LIMIT_BYTES = 32 * 1024;

// Signed in only, and its own route because a wish is not a failure: docs/features/feedback.md.
export const feedbackRoutes = (app: FastifyInstance, sql: SqlClient, clock: () => Date): void => {
  const feedback = new FeedbackRepository(sql);
  app.post(
    FEEDBACK_PATH,
    {
      bodyLimit: FEEDBACK_BODY_LIMIT_BYTES,
      preHandler: rateLimitHook(rateLimits.feedbackPerAccount, (request) => request.session?.accountId ?? null, clock),
    },
    async (request, reply) => {
      const { text, surface, kind, overviewId, trail = [] } = parseOrThrow(FeedbackRequest, request.body, "The feedback");
      if (request.client === null) {
        throw new ApiError("invalid_request", "Feedback needs the client's version");
      }
      const redacted = redactFeedbackText(text);
      if (redacted.length === 0) {
        throw new ApiError("invalid_request", "The feedback is empty");
      }
      const accountId = request.session!.accountId;
      const actions = kind === "wrong" ? trail.map(({ name }) => name).filter(isAnalyticsEventName) : [];
      await feedback.insert({
        accountId,
        createdAt: clock(),
        surface,
        clientVersion: request.client.version,
        overviewId: overviewId ?? null,
        kind: kind ?? null,
        text: redacted,
        trail: actions,
      });
      request.log.info(
        apiLogLines.feedback.received({
          plan: await accountPlan(sql, accountId),
          surface,
          kind: kind ?? "none",
          fromOverview: overviewId !== undefined,
          actions: actions.length,
        }),
      );
      return reply.status(204).send();
    },
  );
};
