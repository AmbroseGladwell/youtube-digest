import type { FastifyInstance } from "fastify";
import { saveQuotas, type OverviewUsage } from "@overview/domain";
import { accountPlan } from "../auth/accountPlan.js";
import type { SqlClient } from "../db/SqlClient.js";
import type { createPodcastTranscriptions } from "../podcasts/createPodcastTranscriptions.js";
import type { CaptureSavesRepository } from "../usage/CaptureSavesRepository.js";
import type { OverviewUsageRepository } from "../usage/OverviewUsageRepository.js";

export interface OverviewUsageRoutesOptions {
  usage: OverviewUsageRepository;
  saves: CaptureSavesRepository;
  transcriptions: Pick<ReturnType<typeof createPodcastTranscriptions>, "usage"> | null;
  sql: SqlClient;
  clock: () => Date;
}

export const overviewUsageRoutes = (
  app: FastifyInstance,
  { usage, saves, transcriptions, sql, clock }: OverviewUsageRoutesOptions,
): void => {
  app.get("/overview-usage", async (request): Promise<OverviewUsage> => {
    const { accountId } = request.session!;
    const plan = await accountPlan(sql, accountId);
    const now = clock();
    const overviews = {
      ...(await usage.usage(now, accountId, plan)),
      saves: { used: await saves.usedIn(now, accountId), limit: saveQuotas[plan] },
    };
    if (transcriptions === null) {
      return overviews;
    }
    return { ...overviews, transcription: await transcriptions.usage(now, { accountId, plan }) };
  });
};
