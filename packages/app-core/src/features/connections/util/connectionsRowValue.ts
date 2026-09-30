import type { PlanStatus } from "../../plus/usePlan.js";

export interface ConnectionsRowState {
  signedIn: boolean;
  planStatus: PlanStatus;
  isPlus: boolean;
  count: number | undefined;
  countFailed: boolean;
}

export const CHECKING_ROW_VALUE = "Checking…";
export const UNREACHABLE_ROW_VALUE = "Couldn't check";

// Design 58i–58r: what the Connections row in Settings says before it is opened. What is not
// known yet is said as such, never guessed as Free or as none.
export function connectionsRowValue({ signedIn, planStatus, isPlus, count, countFailed }: ConnectionsRowState): string {
  if (!signedIn) return "Sign in first";
  if (planStatus !== "known") return planStatus === "checking" ? CHECKING_ROW_VALUE : UNREACHABLE_ROW_VALUE;
  if (!isPlus) return "Needs Plus";
  if (count === undefined) return countFailed ? UNREACHABLE_ROW_VALUE : CHECKING_ROW_VALUE;
  return count === 0 ? "None" : `${count} connected`;
}
