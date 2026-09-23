import { z } from "zod";
import { AnthropicModel, DEFAULT_ANTHROPIC_MODEL } from "./AnthropicModel.js";
import { DEFAULT_PLAN, Plan } from "./Plan.js";

export const SectionsEnabled = z.object({
  verdict: z.boolean(),
  selling: z.boolean(),
  howToApply: z.boolean(),
  watchAnyway: z.boolean(),
});
export type SectionsEnabled = z.infer<typeof SectionsEnabled>;

export const DEFAULT_SECTIONS_ENABLED: SectionsEnabled = {
  verdict: true,
  selling: true,
  howToApply: true,
  watchAnyway: true,
};

export const Settings = z.object({
  sectionsEnabled: SectionsEnabled,
  readerContext: z.string().nullable(),
  // Which model is not a secret (unlike the API key it's called with), so it belongs
  // here rather than in the device-local ApiKeys store — a genuine sync-eligible
  // preference, per docs/architecture/v1-architecture-decisions.md's split.
  model: AnthropicModel,
  plan: Plan,
  plusNoticeDismissed: z.boolean(),
});
export type Settings = z.infer<typeof Settings>;

export const DEFAULT_SETTINGS: Settings = {
  sectionsEnabled: DEFAULT_SECTIONS_ENABLED,
  readerContext: null,
  model: DEFAULT_ANTHROPIC_MODEL,
  plan: DEFAULT_PLAN,
  plusNoticeDismissed: false,
};
