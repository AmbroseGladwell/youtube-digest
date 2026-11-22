import type { KeySource, Plan } from "@overview/domain";

export interface KeyOrderContext {
  ourKeyUsable: boolean;
  plan: Plan | null;
  hasOwnKey: boolean;
  onlyMyKey: boolean;
}

// docs/architecture/tiers.md, "Which key an overview uses".
export const keyOrderFor = ({ ourKeyUsable, plan, hasOwnKey, onlyMyKey }: KeyOrderContext): KeySource[] => {
  if (!hasOwnKey) {
    return ourKeyUsable ? ["ours"] : [];
  }
  if (!ourKeyUsable || onlyMyKey) {
    return ["own"];
  }
  return plan === "plus" ? ["ours", "own"] : ["own", "ours"];
};
