import { z } from "zod";
import { AnthropicModel, DEFAULT_ANTHROPIC_MODEL } from "./AnthropicModel.js";
import { DEFAULT_NARRATION_VOICE, NarrationVoice } from "./NarrationVoice.js";
import { DEFAULT_PLAN, Plan } from "./Plan.js";
import { MilestoneMarks } from "./Milestone.js";
import { TagAliases } from "./TagAliases.js";

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
  narrationVoice: NarrationVoice.catch(DEFAULT_NARRATION_VOICE),
  // When each time-saved milestone was crossed and dismissed, on the account so both hold
  // on every device (docs/features/time-saved.md).
  milestones: MilestoneMarks.catch({}),
  // Off hides the milestone cards on every device; Settings › Milestones still lists them.
  showMilestoneCards: z.boolean().catch(true),
  // A signed-in reader's "no" to sharing usage, on the account so it holds on every device
  // and the server drops their events (docs/features/analytics-consent.md).
  analyticsOptOut: z.boolean().catch(false),
  analyticsOptOutChangedAt: z.iso.datetime().nullable().catch(null),
  // Replaced whole rather than merged one level, so that an undo can take an alias away
  // (docs/features/tag-reuse.md).
  tagAliases: TagAliases.catch({}),
});
export type Settings = z.infer<typeof Settings>;

export const DEFAULT_SETTINGS: Settings = {
  sectionsEnabled: DEFAULT_SECTIONS_ENABLED,
  readerContext: null,
  model: DEFAULT_ANTHROPIC_MODEL,
  plan: DEFAULT_PLAN,
  plusNoticeDismissed: false,
  narrationVoice: DEFAULT_NARRATION_VOICE,
  milestones: {},
  showMilestoneCards: true,
  analyticsOptOut: false,
  analyticsOptOutChangedAt: null,
  tagAliases: {},
};
