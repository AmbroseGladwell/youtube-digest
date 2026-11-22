import type { KeySource, Plan } from "@overview/domain";

// The quotas: docs/architecture/tiers.md, "The tiers".
export const overviewQuotas = {
  free: { ours: 5, own: 10 },
  "byo-plus": { ours: 10, own: 200 },
  plus: { ours: 50, own: 200 },
} as const satisfies Record<Plan, Record<KeySource, number>>;
