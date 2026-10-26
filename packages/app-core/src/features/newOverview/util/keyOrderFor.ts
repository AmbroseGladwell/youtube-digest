import type { KeySource, Plan } from "@overview/domain";

export interface KeyOrderContext {
  // Our key needs a server that makes overviews on it, and an account or a trial with one left.
  ourKeyUsable: boolean;
  plan: Plan | null;
  hasOwnKey: boolean;
  onlyMyKey: boolean;
}

// Which keys an overview is tried on, in order (docs/architecture/tiers.md, "Which key an
// overview uses"): Plus pays for ours, so it goes first; everyone else spends their own key
// first and keeps ours as the safety net. "Only ever use my key" leaves the reader's key alone.
export function keyOrderFor({ ourKeyUsable, plan, hasOwnKey, onlyMyKey }: KeyOrderContext): KeySource[] {
  if (!hasOwnKey) return ourKeyUsable ? ["ours"] : [];
  if (!ourKeyUsable || onlyMyKey) return ["own"];
  return plan === "plus" ? ["ours", "own"] : ["own", "ours"];
}
