import type { Plan } from "@overview/domain";

// Chat messages a UTC month per account, all on our key, set on 16 Nov 2026; apart from
// the overview quotas, so chatting never spends an overview (docs/architecture/tiers.md).
export const chatAllowances = {
  free: 100,
  "byo-plus": 500,
  plus: 1_000,
} as const satisfies Record<Plan, number>;

// Behind every plan's month, so one day can't spend it all at once.
export const CHAT_MESSAGES_PER_ACCOUNT_DAILY = 200;
