import type { KeySource } from "./KeySource.js";
import type { Plan } from "./Plan.js";

// The quotas: docs/architecture/tiers.md, "The tiers". The server counts against these, and the app sells by them.
export const overviewQuotas = {
  free: { ours: 5, own: 10 },
  "byo-plus": { ours: 10, own: 200 },
  plus: { ours: 50, own: 200 },
} as const satisfies Record<Plan, Record<KeySource, number>>;

export const transcriptionHours = { free: 5, "byo-plus": 15, plus: 30 } as const satisfies Record<Plan, number>;

// Saves without an overview a month: docs/features/kept-links.md, "The save limit". BYO Plus has Free's (OV-351).
export const saveQuotas = {
  free: 50,
  "byo-plus": 50,
  plus: 300,
} as const satisfies Record<Plan, number>;

export const SUGGESTED_QUESTION_PLANS: ReadonlySet<Plan> = new Set(["byo-plus", "plus"]);
