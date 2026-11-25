import {
  overviewQuotas,
  SUGGESTED_QUESTION_PLANS,
  transcriptionHours,
  type ChatUsage,
  type OverviewUsage,
  type Plan,
} from "@overview/domain";
import type { NextQuota } from "../../newOverview/util/nextQuota.js";

const HOUR = 3600;
export const TRANSCRIBING_LINE_UNDER_SECONDS = 2 * HOUR;

export type OnUsSpent = "overviews" | "hours" | "questions";

export type PlanPromptMoment =
  | { kind: "pill" }
  | { kind: "menu" }
  | { kind: "counter"; next: NextQuota | null }
  | { kind: "reset" }
  | { kind: "transcribing"; episodeSeconds: number | null }
  | { kind: "questions" }
  | { kind: "hours" }
  | { kind: "chat" }
  | { kind: "saves" };

export interface PlanPromptUsage {
  overviews: OverviewUsage | null;
  chat: ChatUsage | null;
}

export type PlanPrompt =
  | { variant: "pill" }
  | { variant: "menu"; spent: OnUsSpent | null }
  | { variant: "counter" | "nudge"; left: number; limit: number; resetsOn: string }
  | { variant: "reset"; limit: number }
  | { variant: "transcribing"; moreHours: number }
  | { variant: "questions" }
  | { variant: "hours" | "chat" | "saves"; offersPlus: boolean };

interface Allowance {
  used: number;
  limit: number;
}

const isSpent = (allowance: Allowance | undefined): boolean =>
  allowance !== undefined && allowance.limit > 0 && allowance.used >= allowance.limit;

// The allowances on us that Plus raises; a BYO Plus reader's own-key count never prompts.
const onUsSpentOf = ({ overviews, chat }: PlanPromptUsage): OnUsSpent | null => {
  if (isSpent(overviews?.ours)) {
    return "overviews";
  }
  const transcription = overviews?.transcription;
  if (transcription !== undefined && isSpent({ used: transcription.usedSeconds, limit: transcription.limitSeconds })) {
    return "hours";
  }
  if (chat !== null && isSpent(chat)) {
    return "questions";
  }
  return null;
};

// Who sees each prompt: docs/features/plus-upsell.md, "Who sees what" (design 351k).
export const planPromptFor = (plan: Plan, usage: PlanPromptUsage, moment: PlanPromptMoment): PlanPrompt | null => {
  switch (moment.kind) {
    case "pill":
      return plan === "free" ? { variant: "pill" } : null;
    case "menu": {
      if (plan === "free") {
        return { variant: "menu", spent: null };
      }
      const spent = plan === "byo-plus" ? onUsSpentOf(usage) : null;
      return spent === null ? null : { variant: "menu", spent };
    }
    case "counter": {
      const { next } = moment;
      if (plan === "plus" || next?.kind !== "quota" || next.key !== "ours") {
        return null;
      }
      return { variant: next.left === 1 ? "nudge" : "counter", left: next.left, limit: next.limit, resetsOn: next.resetsOn };
    }
    case "reset":
      return plan !== "plus" && usage.overviews?.lastMonthOursSpent === true
        ? { variant: "reset", limit: overviewQuotas[plan].ours }
        : null;
    case "transcribing": {
      const transcription = usage.overviews?.transcription;
      if (plan === "plus" || transcription === undefined || moment.episodeSeconds === null) {
        return null;
      }
      const leftAfter = transcription.limitSeconds - transcription.usedSeconds - moment.episodeSeconds;
      return leftAfter < TRANSCRIBING_LINE_UNDER_SECONDS
        ? { variant: "transcribing", moreHours: transcriptionHours.plus - transcriptionHours[plan] }
        : null;
    }
    case "questions":
      return SUGGESTED_QUESTION_PLANS.has(plan) ? null : { variant: "questions" };
    case "hours":
    case "chat":
    case "saves":
      return { variant: moment.kind, offersPlus: plan !== "plus" };
  }
};
