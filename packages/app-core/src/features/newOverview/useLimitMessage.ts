import { DEFAULT_PLAN } from "@overview/domain";
import { useOverviewUsageQuery } from "./queries/overviewUsageQuery.js";
import { useNextQuota } from "./useNextQuota.js";
import { limitMessageOf, type LimitMessage } from "./util/limitMessage.js";

// The message that takes Generate's place once every key the next overview could use is
// spent, or the signed-out trial is.
export function useLimitMessage(): LimitMessage | null {
  const next = useNextQuota();
  const plan = useOverviewUsageQuery().data?.plan ?? DEFAULT_PLAN;
  return limitMessageOf(next, plan);
}
