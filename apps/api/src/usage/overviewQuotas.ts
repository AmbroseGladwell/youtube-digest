import type { KeySource, Plan } from "@overview/domain";

// Overviews a UTC month per account, on each key, set on 18 Oct 2026, with Free's own-key
// quota cut from 30 to 10 on 20 Oct 2026. They are separate quotas, so running out of one
// leaves the other (docs/architecture/tiers.md).
export const overviewQuotas = {
  free: { ours: 5, own: 10 },
  "byo-plus": { ours: 10, own: 200 },
  plus: { ours: 50, own: 200 },
} as const satisfies Record<Plan, Record<KeySource, number>>;
