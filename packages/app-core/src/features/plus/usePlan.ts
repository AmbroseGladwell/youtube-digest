import { DEFAULT_PLAN, type Plan } from "@overview/domain";
import { isSyncRequestError } from "@overview/sync";
import { useSessionQuery } from "../auth/queries/sessionQuery.js";
import { useSync } from "../sync/SyncContext.js";

export type PlanStatus = "known" | "checking" | "unreachable";

export interface PlanState {
  plan: Plan;
  status: PlanStatus;
  recheck: () => void;
}

// docs/features/plus-upsell.md, "The plan is the account's, and nothing is gated on it".
export const usePlan = (): PlanState => {
  const sync = useSync();
  const session = useSessionQuery();
  const recheck = () => void session.refetch();
  const signedOut = !sync.connected || (isSyncRequestError(session.error) && session.error.code === "unauthenticated");

  if (signedOut) {
    return { plan: DEFAULT_PLAN, status: "known", recheck };
  }
  if (session.data !== undefined) {
    return { plan: session.data.plan, status: "known", recheck };
  }
  return { plan: DEFAULT_PLAN, status: session.isError ? "unreachable" : "checking", recheck };
};
