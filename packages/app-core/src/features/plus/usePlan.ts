import { DEFAULT_PLAN, type Plan } from "@overview/types";
import { useSettingsQuery } from "../settings/queries/settingsQuery.js";

export interface PlanState {
  plan: Plan;
  isPlus: boolean;
}

// The fallback is here rather than left to DEFAULT_SETTINGS because a settings record
// written before plan existed comes back with no such key at all — the unvalidated-read
// trap in docs/architecture/v1-architecture-decisions.md.
export function usePlan(): PlanState {
  const plan = useSettingsQuery().data?.plan ?? DEFAULT_PLAN;
  return { plan, isPlus: plan === "plus" };
}
