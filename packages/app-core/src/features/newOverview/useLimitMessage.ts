import { DEFAULT_PLAN } from "@overview/domain";
import { useOverviewUsageQuery } from "./queries/overviewUsageQuery.js";
import { useNextQuota } from "./useNextQuota.js";
import { limitMessageOf, type LimitMessage } from "./util/limitMessage.js";

export const useLimitMessage = (): LimitMessage | null => {
  const next = useNextQuota();
  const plan = useOverviewUsageQuery().data?.plan ?? DEFAULT_PLAN;
  return limitMessageOf(next, plan);
};
