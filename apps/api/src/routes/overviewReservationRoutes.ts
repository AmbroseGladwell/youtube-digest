import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { apiLogLines, OverviewId, OverviewReservationRequest } from "@overview/domain";
import { accountPlan } from "../auth/accountPlan.js";
import type { SqlClient } from "../db/SqlClient.js";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import type { SharesRepository } from "../shares/SharesRepository.js";
import { overviewQuotas } from "../usage/overviewQuotas.js";
import type { OverviewReservationsRepository } from "../usage/OverviewReservationsRepository.js";
import type { OverviewUsageRepository } from "../usage/OverviewUsageRepository.js";
import type { TrialsRepository } from "../usage/TrialsRepository.js";
import { nextUsageMonth, secondsToNextUsageMonth } from "../usage/usageMonth.js";

const Params = z.object({ overviewId: OverviewId });

export function overviewReservationRoutes(
  app: FastifyInstance,
  {
    reservations,
    usage,
    trials,
    shares,
    sql,
    clock,
  }: {
    reservations: OverviewReservationsRepository;
    usage: OverviewUsageRepository;
    trials: TrialsRepository;
    shares: SharesRepository;
    sql: SqlClient;
    clock: () => Date;
  },
): void {
  app.post("/overview-reservations", async (request, reply) => {
    const { overviewId, shareToken } = parseOrThrow(OverviewReservationRequest, request.body, "The reservation");
    const { accountId } = request.session!;
    const now = clock();
    const plan = await accountPlan(sql, accountId);
    if (shareToken !== undefined) {
      const share = await shares.overviewFor(shareToken);
      if (share === null || share.stopped || share.overviewId !== overviewId) {
        throw new ApiError("not_found", "No live share of that overview");
      }
      await reservations.savedFromShare(now, accountId, overviewId);
      request.log.info(apiLogLines.reservations.shareSaved({ plan }));
      return usage.usage(now, accountId, plan);
    }
    if (await trials.madeInTrial(overviewId)) {
      const moved = await reservations.movedFromTrial(now, accountId, overviewId, overviewQuotas[plan].ours);
      if (!moved.reserved) {
        const retryAfterSeconds = secondsToNextUsageMonth(now);
        request.log.info(apiLogLines.ourKey.quotaSpent({ plan, used: moved.used, limit: moved.limit }));
        reply.header("retry-after", String(retryAfterSeconds));
        throw new ApiError("too_many_requests", "You've made this month's overviews on our key", {
          quota: "ours",
          resetsOn: nextUsageMonth(now),
          retryAfterSeconds,
        });
      }
      await trials.forget(overviewId);
      request.log.info(apiLogLines.reservations.movedFromTrial({ plan, used: moved.used, limit: moved.limit }));
      return usage.usage(now, accountId, plan);
    }
    const reservation = await reservations.reserveOwn(now, accountId, overviewId, overviewQuotas[plan].own);
    if (!reservation.reserved) {
      const retryAfterSeconds = secondsToNextUsageMonth(now);
      request.log.info(apiLogLines.reservations.quotaSpent({ plan, used: reservation.used, limit: reservation.limit }));
      reply.header("retry-after", String(retryAfterSeconds));
      throw new ApiError("too_many_requests", "You've made this month's overviews on your own key", {
        quota: "own",
        resetsOn: nextUsageMonth(now),
        retryAfterSeconds,
      });
    }
    const current = await usage.usage(now, accountId, plan);
    request.log.info(apiLogLines.reservations.reserved({ plan, used: current.own.used, limit: current.own.limit }));
    return current;
  });

  app.delete("/overview-reservations/:overviewId", async (request, reply) => {
    const { overviewId } = parseOrThrow(Params, request.params, "The overview's id");
    if (await reservations.release(request.session!.accountId, overviewId)) {
      request.log.info(apiLogLines.reservations.released());
    }
    return reply.status(204).send();
  });
}
