import type { PlanPromptDismissals, PlanPromptVariant } from "@overview/domain";

const usageMonthStart = (now: Date): number => Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);

const sameLocalDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// Put away until tomorrow; the reset line is shown once a month: docs/features/plus-upsell.md, "Dismissing".
export const isPlanPromptHidden = (variant: PlanPromptVariant, dismissals: PlanPromptDismissals, now: Date): boolean => {
  const at = dismissals[variant];
  if (at === undefined) {
    return false;
  }
  const when = new Date(at);
  return variant === "reset" ? when.getTime() >= usageMonthStart(now) : sameLocalDay(when, now);
};
