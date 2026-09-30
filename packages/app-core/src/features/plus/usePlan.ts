import { DEFAULT_PLAN, type Plan } from "@overview/domain";
import { useSessionQuery } from "../auth/queries/sessionQuery.js";

export interface PlanState {
  plan: Plan;
  isPlus: boolean;
}

// The plan is the account's, as the server holds it, so a device with no session is on
// Free (docs/features/mcp-connector.md, "Plus").
export function usePlan(): PlanState {
  const plan = useSessionQuery().data?.plan ?? DEFAULT_PLAN;
  return { plan, isPlus: plan === "plus" };
}
