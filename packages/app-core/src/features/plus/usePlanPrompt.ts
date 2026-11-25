import { useEffect, useState } from "react";
import type { Plan, PlanPromptOutcome, PlanPromptVariant } from "@overview/domain";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { useChatUsageQuery } from "../chats/queries/chatUsageQuery.js";
import { useOverviewUsageQuery } from "../newOverview/queries/overviewUsageQuery.js";
import { useUpdateSettingsMutation } from "../settings/mutations/useUpdateSettingsMutation.js";
import { useSettingsQuery } from "../settings/queries/settingsQuery.js";
import { usePlan } from "./usePlan.js";
import { isPlanPromptHidden } from "./util/isPlanPromptHidden.js";
import { planPromptFor, type PlanPrompt, type PlanPromptMoment } from "./util/planPromptFor.js";

export interface PlanPromptState {
  prompt: PlanPrompt | null;
  plan: Plan;
  chose: (outcome: PlanPromptOutcome, tellMeWhen?: Plan) => void;
  putAway: () => void;
}

const ONCE_SHOWN: ReadonlySet<PlanPromptVariant> = new Set(["reset"]);

export interface PlanPromptOptions {
  // A copy of a prompt shown elsewhere too, like the home hero's line behind Create: it decides, records nothing.
  quiet?: boolean;
}

// One place decides and records every Plus prompt: docs/features/plus-upsell.md (OV-351).
export const usePlanPrompt = (moment: PlanPromptMoment, { quiet = false }: PlanPromptOptions = {}): PlanPromptState => {
  const analytics = useAnalytics();
  const { plan, status } = usePlan();
  const overviews = useOverviewUsageQuery().data ?? null;
  const chat = useChatUsageQuery().data ?? null;
  const settings = useSettingsQuery().data;
  const updateSettings = useUpdateSettingsMutation();

  const [shownOnceHere, setShownOnceHere] = useState<PlanPromptVariant | null>(null);

  const decided = status === "known" && settings !== undefined ? planPromptFor(plan, { overviews, chat }, moment) : null;
  const hidden =
    decided !== null &&
    decided.variant !== shownOnceHere &&
    isPlanPromptHidden(decided.variant, settings?.planPromptsDismissed ?? {}, new Date());
  const prompt = hidden ? null : decided;
  const variant = prompt?.variant ?? null;

  const record = (shown: PlanPromptVariant) => updateSettings.mutate({ planPromptsDismissed: { [shown]: new Date().toISOString() } });

  useEffect(() => {
    if (variant === null || quiet) {
      return;
    }
    analytics.plus.prompt.shown({ variant, plan });
    if (ONCE_SHOWN.has(variant)) {
      setShownOnceHere(variant);
      record(variant);
    }
  }, [variant]);

  return {
    prompt,
    plan,
    chose: (outcome, tellMeWhen) => {
      if (variant !== null) {
        analytics.plus.prompt.chosen({ variant, plan, outcome, ...(tellMeWhen === undefined ? {} : { tellMeWhen }) });
      }
    },
    putAway: () => {
      if (variant === null) {
        return;
      }
      analytics.plus.prompt.chosen({ variant, plan, outcome: "notNow" });
      setShownOnceHere(null);
      record(variant);
    },
  };
};
