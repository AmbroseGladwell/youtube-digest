import { z } from "zod";

// Every place Plus is offered: docs/features/plus-upsell.md (OV-351).
export const PlanPromptVariant = z.enum([
  "menu",
  "pill",
  "counter",
  "nudge",
  "reset",
  "transcribing",
  "questions",
  "hours",
  "chat",
  "saves",
  "wall",
  "panelWall",
  "modal",
  "settings",
]);
export type PlanPromptVariant = z.infer<typeof PlanPromptVariant>;

export const PlanPromptOutcome = z.enum(["seePlans", "notNow", "dismissed", "keptForReset", "tellMeWhen"]);
export type PlanPromptOutcome = z.infer<typeof PlanPromptOutcome>;

// When each was last put away or, for the reset line, shown; merged one key at a time across devices.
export const PlanPromptDismissals = z.partialRecord(PlanPromptVariant, z.iso.datetime());
export type PlanPromptDismissals = z.infer<typeof PlanPromptDismissals>;
