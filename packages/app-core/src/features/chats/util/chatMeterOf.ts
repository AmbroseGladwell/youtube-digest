import type { ChatUsage, Plan } from "@overview/domain";

export type ChatUpsell = "seePlans" | "seePlus";

export interface ChatMeter {
  percent: number;
  warning: boolean;
  resetsOn: string;
  upsell: ChatUpsell | null;
}

const QUIET_FROM = 50;
const WARNING_FROM = 90;

// Only plans that give more chat on the key in use (OV-310's rule).
export const CHAT_UPSELL: Record<Plan, ChatUpsell | null> = { free: "seePlans", "byo-plus": "seePlus", plus: null };

export const chatUpsellLabel = (upsell: ChatUpsell): string => (upsell === "seePlans" ? "See plans" : "See Plus");

export const chatPercentUsed = (share: number): number => Math.min(100, Math.floor(share * 100));

// Design 376a–376c: nothing under half used, the quiet line in tens from half, the warning in whole percent from 90.
export const chatMeterOf = (usage: ChatUsage | null): ChatMeter | null => {
  if (usage?.share === undefined) {
    return null;
  }
  const percent = chatPercentUsed(usage.share);
  if (percent < QUIET_FROM) {
    return null;
  }
  const warning = percent >= WARNING_FROM;
  return {
    percent: warning ? percent : Math.floor(percent / 10) * 10,
    warning,
    resetsOn: usage.resetsOn,
    upsell: warning ? CHAT_UPSELL[usage.plan] : null,
  };
};

export type ChatMeterState = "half" | "warning" | "month" | "library";

export type SpentWait = { kind: "month"; resetsOn: string } | { kind: "libraryMonth"; resetsOn: string };

// The wait the month's usage already calls for, before anything is asked; a server before OV-376 counts questions.
export const spentWaitOf = (usage: ChatUsage | null, scope: "overview" | "library"): SpentWait | null => {
  if (usage === null) {
    return null;
  }
  const spent = usage.share === undefined ? usage.used >= usage.limit : usage.share >= 1;
  if (spent) {
    return { kind: "month", resetsOn: usage.resetsOn };
  }
  return scope === "library" && usage.libraryFits === false ? { kind: "libraryMonth", resetsOn: usage.resetsOn } : null;
};

export const chatMeterStateOf = (waitKind: string | null, meter: ChatMeter | null): ChatMeterState | null => {
  if (waitKind === "month") {
    return "month";
  }
  if (waitKind === "libraryMonth") {
    return "library";
  }
  if (meter === null) {
    return null;
  }
  return meter.warning ? "warning" : "half";
};
