import type { Plan } from "./Plan.js";

// Chat messages a UTC month per account, all on our key, set on 16 Nov 2026; apart from
// the overview quotas, so chatting never spends an overview (docs/architecture/tiers.md).
export const chatAllowances = {
  free: 100,
  "byo-plus": 500,
  plus: 1_000,
} as const satisfies Record<Plan, number>;

// Behind every plan's month, so one day can't spend it all at once.
export const CHAT_MESSAGES_PER_ACCOUNT_DAILY = 200;

// OV-376: usage is list-price cost in micro-dollars, and one question means one about long-form content (docs/architecture/tiers.md, "Chat usage").
export const CHAT_UNITS_PER_QUESTION = 1_400;

export const chatUsageAllowances = {
  free: chatAllowances.free * CHAT_UNITS_PER_QUESTION,
  "byo-plus": chatAllowances["byo-plus"] * CHAT_UNITS_PER_QUESTION,
  plus: chatAllowances.plus * CHAT_UNITS_PER_QUESTION,
} as const satisfies Record<Plan, number>;

export const chatUnitsOf = (costDollars: number): number => Math.max(0, Math.round(costDollars * 1_000_000));
