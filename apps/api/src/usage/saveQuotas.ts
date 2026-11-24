import type { Plan } from "@overview/domain";

// Saves without an overview a month: docs/features/kept-links.md, "The save limit".
export const saveQuotas = {
  free: 50,
  "byo-plus": 150,
  plus: 300,
} as const satisfies Record<Plan, number>;
