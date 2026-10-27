import type { KeySource, OverviewUsage } from "@overview/domain";

export interface SpentQuota {
  key: KeySource;
  limit: number;
}

export type NextQuota =
  | { kind: "checking" }
  | { kind: "unreachable" }
  | { kind: "trial"; left: number; total: number }
  | { kind: "quota"; key: KeySource; left: number; limit: number; resetsOn: string; passedOver: SpentQuota | null }
  | { kind: "spent"; spent: SpentQuota[]; resetsOn: string };

export interface NextQuotaContext {
  order: KeySource[];
  // Signed out, the device's trial on either key; signed in, the account's month.
  trial: { made: number; total: number } | null;
  usage: { status: "checking" | "unreachable" } | { status: "known"; data: OverviewUsage };
}

// The quota the next overview will use, walking the key order the way makeOverviewOnKeys
// does (docs/architecture/tiers.md, "Which key an overview uses"). Signed out it is the
// trial, which counts either key. Null where no key can make one, which the key prompt
// answers instead.
export function nextQuotaOf({ order, trial, usage }: NextQuotaContext): NextQuota | null {
  if (trial !== null) return { kind: "trial", left: Math.max(0, trial.total - trial.made), total: trial.total };
  if (order.length === 0) return null;
  if (usage.status !== "known") return { kind: usage.status };

  const { resetsOn } = usage.data;
  const spent: SpentQuota[] = [];
  for (const key of order) {
    const { used, limit } = usage.data[key];
    const left = Math.max(0, limit - used);
    if (left > 0) return { kind: "quota", key, left, limit, resetsOn, passedOver: spent.at(-1) ?? null };
    spent.push({ key, limit });
  }
  return { kind: "spent", spent, resetsOn };
}
