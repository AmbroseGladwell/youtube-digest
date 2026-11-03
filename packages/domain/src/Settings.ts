import { z } from "zod";
import { AboutYou, EMPTY_ABOUT_YOU } from "./AboutYou.js";
import { AccentColour, DEFAULT_ACCENT_COLOUR, DEFAULT_THEME_MODE, ThemeMode } from "./Appearance.js";
import { ModelByProvider } from "./ModelByProvider.js";
import { DEFAULT_PROVIDER, Provider } from "./Provider.js";
import { DEFAULT_NARRATION_VOICE, NarrationVoice } from "./NarrationVoice.js";
import { DEFAULT_PLAN, Plan } from "./Plan.js";
import { MilestoneMarks } from "./Milestone.js";
import { TagAliases } from "./TagAliases.js";
import { LearnedItems } from "./LearnedItem.js";
import { DEFAULT_PLAYLIST_PACE, PlaylistPace } from "./PlaylistPace.js";

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
  // The sentence as it was composed, written beside aboutYou for clients from before it
  // (docs/features/personalisation.md, "The old line"). Generation reads aboutYou.
  readerContext: z.string().nullable(),
  aboutYou: AboutYou.catch(EMPTY_ABOUT_YOU),
  // What the profile pass has picked up, and how far through the library it had got. Learned
  // items merge one by one (docs/features/personalisation.md, "A profile that learns").
  learned: LearnedItems.catch({}),
  keepLearning: z.boolean().catch(true),
  overviewsAtLastProfilePass: z.number().int().nonnegative().catch(0),
  // Which provider and model is not a secret (unlike the API keys they are called with),
  // so the choice belongs here rather than in the device-local ApiKeys store — a genuine
  // sync-eligible preference, per docs/architecture/v1-architecture-decisions.md's split.
  // The asymmetry this creates is a designed state, not an oversight: a reader can arrive
  // on a device holding no key for the provider they chose (design 110g).
  provider: Provider.catch(DEFAULT_PROVIDER),
  modelByProvider: ModelByProvider.catch({}),
  plan: Plan,
  plusNoticeDismissed: z.boolean(),
  narrationVoice: NarrationVoice.catch(DEFAULT_NARRATION_VOICE),
  // When each time-saved milestone was crossed and dismissed, on the account so both hold
  // on every device (docs/features/time-saved.md).
  milestones: MilestoneMarks.catch({}),
  // Off hides the milestone cards on every device; Settings › Milestones still lists them.
  showMilestoneCards: z.boolean().catch(true),
  // A signed-in reader's "no" to analytics, on the account so it holds on every device
  // and the server drops their events (docs/features/analytics-consent.md).
  analyticsOptOut: z.boolean().catch(false),
  analyticsOptOutChangedAt: z.iso.datetime().nullable().catch(null),
  // Replaced whole rather than merged one level, so that an undo can take an alias away
  // (docs/features/tag-reuse.md).
  tagAliases: TagAliases.catch({}),
  // "Only ever use my key": on, an overview the reader's own key can't make fails rather
  // than moving to ours, which would send the transcript and reader context to OpenAI
  // through our server. Off by default (docs/architecture/tiers.md).
  onlyMyKey: z.boolean().catch(false),
  // The pace a newly followed playlist starts at. Playlists already followed keep their own
  // (docs/features/playlists.md, "A pace for each playlist").
  defaultPlaylistPace: PlaylistPace.catch(DEFAULT_PLAYLIST_PACE),
  // On the account, so the app looks the same on every device (docs/features/appearance.md).
  theme: ThemeMode.catch(DEFAULT_THEME_MODE),
  accentColour: AccentColour.catch(DEFAULT_ACCENT_COLOUR),
});
export type Settings = z.infer<typeof Settings>;

export const DEFAULT_SETTINGS: Settings = {
  sectionsEnabled: DEFAULT_SECTIONS_ENABLED,
  readerContext: null,
  aboutYou: EMPTY_ABOUT_YOU,
  learned: {},
  keepLearning: true,
  overviewsAtLastProfilePass: 0,
  provider: DEFAULT_PROVIDER,
  modelByProvider: {},
  plan: DEFAULT_PLAN,
  plusNoticeDismissed: false,
  narrationVoice: DEFAULT_NARRATION_VOICE,
  milestones: {},
  showMilestoneCards: true,
  analyticsOptOut: false,
  analyticsOptOutChangedAt: null,
  tagAliases: {},
  onlyMyKey: false,
  defaultPlaylistPace: DEFAULT_PLAYLIST_PACE,
  theme: DEFAULT_THEME_MODE,
  accentColour: DEFAULT_ACCENT_COLOUR,
};
