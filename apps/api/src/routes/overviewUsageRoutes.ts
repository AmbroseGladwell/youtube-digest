import type { FastifyInstance } from "fastify";
import type { OverviewUsage } from "@overview/domain";
import { accountPlan } from "../auth/accountPlan.js";
import type { SqlClient } from "../db/SqlClient.js";
import type { createPodcastTranscriptions } from "../podcasts/createPodcastTranscriptions.js";
import type { OverviewUsageRepository } from "../usage/OverviewUsageRepository.js";

// The month's overviews, and its transcribing where this server transcribes episodes.
export const overviewUsageRoutes = (
  app: FastifyInstance,
  {
    usage,
    transcriptions,
    sql,
    clock,
  }: {
    usage: OverviewUsageRepository;
    transcriptions: Pick<ReturnType<typeof createPodcastTranscriptions>, "usage"> | null;
    sql: SqlClient;
    clock: () => Date;
  },
): void => {
  app.get("/overview-usage", async (request): Promise<OverviewUsage> => {
    const { accountId } = request.session!;
    const plan = await accountPlan(sql, accountId);
    const now = clock();
    const overviews = await usage.usage(now, accountId, plan);
    if (transcriptions === null) {
      return overviews;
    }
    return { ...overviews, transcription: await transcriptions.usage(now, { accountId, plan }) };
  });
};
