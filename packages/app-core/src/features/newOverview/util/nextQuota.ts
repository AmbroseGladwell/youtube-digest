import type { KeySource, OverviewUsage } from "@overview/domain";

export interface SpentQuota {
  key: KeySource;
  limit: number;
}

export type NextQuota =
  | { kind: "checking" }
  | { kind: "unreachable" }
  | { kind: "quota"; key: KeySource; left: number; limit: number; resetsOn: string; passedOver: SpentQuota | null }
  | { kind: "spent"; spent: SpentQuota[]; resetsOn: string };

export interface NextQuotaContext {
  order: KeySource[];
  usage: { status: "checking" | "unreachable" } | { status: "known"; data: OverviewUsage };
}

// Walks the key order as makeOverviewOnKeys does; null where no key can make one.
export const nextQuotaOf = ({ order, usage }: NextQuotaContext): NextQuota | null => {
  if (order.length === 0) {
    return null;
  }
  if (usage.status !== "known") {
    return { kind: usage.status };
  }

  const { resetsOn } = usage.data;
  const spent: SpentQuota[] = [];
  for (const key of order) {
    const { used, limit } = usage.data[key];
    const left = Math.max(0, limit - used);
    if (left > 0) {
      return { kind: "quota", key, left, limit, resetsOn, passedOver: spent.at(-1) ?? null };
    }
    spent.push({ key, limit });
  }
  return { kind: "spent", spent, resetsOn };
};

// What a backfill or a queue choice can spend before the rest waits for the month.
export const leftThisMonthOf = ({ order, usage }: NextQuotaContext): number | null => {
  if (usage.status !== "known") {
    return null;
  }
  return order.reduce((sum, key) => sum + Math.max(0, usage.data[key].limit - usage.data[key].used), 0);
};
