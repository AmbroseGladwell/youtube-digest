import type { FastifyInstance } from "fastify";
import { accountPlan } from "../auth/accountPlan.js";
import type { SqlClient } from "../db/SqlClient.js";
import type { OverviewUsageRepository } from "../usage/OverviewUsageRepository.js";

export function overviewUsageRoutes(
  app: FastifyInstance,
  { usage, sql, clock }: { usage: OverviewUsageRepository; sql: SqlClient; clock: () => Date },
): void {
  app.get("/overview-usage", async (request) => {
    const { accountId } = request.session!;
    return usage.usage(clock(), accountId, await accountPlan(sql, accountId));
  });
}
