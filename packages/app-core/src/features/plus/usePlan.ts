import { DEFAULT_PLAN, type Plan } from "@overview/domain";
import { isSyncRequestError } from "@overview/sync";
import { useSessionQuery } from "../auth/queries/sessionQuery.js";
import { useSync } from "../sync/SyncContext.js";

export type PlanStatus = "known" | "checking" | "unreachable";

export interface PlanState {
  plan: Plan;
  isPlus: boolean;
  status: PlanStatus;
  recheck: () => void;
}

// The plan is the account's, as the server holds it, so a device with no session is on
// Free. A signed-in device that has not heard back yet does not know its plan, and says so
// rather than calling it Free (docs/features/mcp-connector.md, "Plus").
export function usePlan(): PlanState {
  const sync = useSync();
  const session = useSessionQuery();
  const recheck = () => void session.refetch();
  const signedOut =
    !sync.connected || (isSyncRequestError(session.error) && session.error.code === "unauthenticated");

  if (signedOut) return { plan: DEFAULT_PLAN, isPlus: false, status: "known", recheck };
  if (session.data !== undefined) {
    return { plan: session.data.plan, isPlus: session.data.plan === "plus", status: "known", recheck };
  }
  return { plan: DEFAULT_PLAN, isPlus: false, status: session.isError ? "unreachable" : "checking", recheck };
}
