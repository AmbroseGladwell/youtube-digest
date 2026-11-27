import { z } from "zod";
import { AboutYou, EMPTY_ABOUT_YOU } from "./AboutYou.js";
import {
  AccentColour,
  DEFAULT_ACCENT_COLOUR,
  DEFAULT_HEAD_IMAGE_SIZE,
  DEFAULT_THEME_MODE,
  HeadImageSize,
  ThemeMode,
} from "./Appearance.js";
import { ModelByProvider } from "./ModelByProvider.js";
import { DEFAULT_PROVIDER, Provider } from "./Provider.js";
import { DEFAULT_NARRATION_VOICE, NarrationVoice } from "./NarrationVoice.js";
import { DEFAULT_TIMER_SOUND, TimerSound } from "./TimerSound.js";
import { DEFAULT_PLAN, Plan } from "./Plan.js";
import { MilestoneMarks } from "./Milestone.js";
import { TagAliases } from "./TagAliases.js";
import { TopicAliases } from "./TopicAliases.js";
import { LearnedItems } from "./LearnedItem.js";
import { DEFAULT_PLAYLIST_ORDER, PlaylistOrder } from "./PlaylistOrder.js";
import { DEFAULT_PLAYLIST_PACE, PlaylistPace } from "./PlaylistPace.js";
import { ChosenAssistant } from "./FollowUpAssistant.js";
import { PlanPromptDismissals } from "./PlanPromptVariant.js";

export const SectionsEnabled = z.object({
  verdict: z.boolean(),
  selling: z.boolean(),
  howToApply: z.boolean(),
  watchAnyway: z.boolean(),
  // The steps it gives (OV-250). On for settings saved before it, as the block was.
  steps: z.boolean().catch(true),
  // Hides the block only: resources are still made, since no article text is kept for later (OV-203).
  resources: z.boolean().catch(true),
  // Hides them only: they're still written and kept (OV-266).
  followUpQuestions: z.boolean().catch(true),
});
export type SectionsEnabled = z.infer<typeof SectionsEnabled>;

export const DEFAULT_SECTIONS_ENABLED: SectionsEnabled = {
  verdict: true,
  selling: true,
  howToApply: true,
  watchAnyway: true,
  steps: true,
  resources: true,
  followUpQuestions: true,
};

export const Settings = z.object({
  sectionsEnabled: SectionsEnabled,
  // Written beside aboutYou for older clients: docs/features/personalisation.md, "The old line".
  readerContext: z.string().nullable(),
  aboutYou: AboutYou.catch(EMPTY_ABOUT_YOU),
  // Asked once at a save after onboarding, on any device: docs/features/personalisation.md, "Asked once more".
  aboutYouAskedAfterOnboarding: z.boolean().catch(false),
  // Items merge one by one: docs/features/personalisation.md, "A profile that learns".
  learned: LearnedItems.catch({}),
  keepLearning: z.boolean().catch(true),
  // On by default, agreed on the consent screen: docs/features/mcp-connector.md, "The profile".
  shareProfileWithAssistants: z.boolean().catch(true),
  overviewsAtLastProfilePass: z.number().int().nonnegative().catch(0),
  // Not a secret, so it syncs; a device may hold no key for it, by design (design 110g).
  provider: Provider.catch(DEFAULT_PROVIDER),
  modelByProvider: ModelByProvider.catch({}),
  plan: Plan,
  plusNoticeDismissed: z.boolean(),
  // On the account, so Not now holds on every device (docs/features/plus-upsell.md, OV-351).
  planPromptsDismissed: PlanPromptDismissals.catch({}),
  narrationVoice: NarrationVoice.catch(DEFAULT_NARRATION_VOICE),
  // What a cooking timer rings with, on every device (docs/features/recipe-notes.md, "Timers").
  timerSound: TimerSound.catch(DEFAULT_TIMER_SOUND),
  // The cooking mode's Mute is this setting: docs/features/recipe-notes.md, "Muting the voice".
  readStepsAloud: z.boolean().catch(true),
  // On the account, so both hold on every device (docs/features/time-saved.md).
  milestones: MilestoneMarks.catch({}),
  // Off hides the milestone cards on every device; Settings › Milestones still lists them.
  showMilestoneCards: z.boolean().catch(true),
  // On the account, so it holds everywhere and the server drops events (docs/features/analytics-consent.md).
  analyticsOptOut: z.boolean().catch(false),
  analyticsOptOutChangedAt: z.iso.datetime().nullable().catch(null),
  // Replaced whole, so an undo can take an alias away (docs/features/tag-reuse.md).
  tagAliases: TagAliases.catch({}),
  // Written by the server as topics merge or go: docs/features/topic-filing.md, "Aliases".
  topicAliases: TopicAliases.catch({}),
  // On, a failing own key fails rather than sending the transcript via ours (docs/architecture/tiers.md).
  onlyMyKey: z.boolean().catch(false),
  // On the account, so pausing on one device pauses every one (docs/features/capture-queue.md).
  queuePaused: z.boolean().catch(false),
  // Followed playlists keep their own: docs/features/playlists.md, "A pace for each playlist".
  defaultPlaylistPace: PlaylistPace.catch(DEFAULT_PLAYLIST_PACE),
  // Followed playlists keep their own: docs/features/playlists.md, "An order for each playlist".
  defaultPlaylistOrder: PlaylistOrder.catch(DEFAULT_PLAYLIST_ORDER),
  // On the account, so the app looks the same on every device (docs/features/appearance.md).
  theme: ThemeMode.catch(DEFAULT_THEME_MODE),
  accentColour: AccentColour.catch(DEFAULT_ACCENT_COLOUR),
  headImageSize: HeadImageSize.catch(DEFAULT_HEAD_IMAGE_SIZE),
  // Null until picked, when a single connected assistant stands in (docs/features/follow-up-questions.md).
  followUpAssistant: ChosenAssistant.nullable().catch(null),
  // Where chat is offered, a tapped question is answered in the app (docs/features/chats.md).
  questionsAnsweredHere: z.boolean().catch(true),
  // Off leaves projects out of the prompt: docs/features/personalisation.md, "Filing into projects".
  fileIntoProjects: z.boolean().catch(true),
});
export type Settings = z.infer<typeof Settings>;

export const DEFAULT_SETTINGS: Settings = {
  sectionsEnabled: DEFAULT_SECTIONS_ENABLED,
  readerContext: null,
  aboutYou: EMPTY_ABOUT_YOU,
  aboutYouAskedAfterOnboarding: false,
  learned: {},
  keepLearning: true,
  shareProfileWithAssistants: true,
  overviewsAtLastProfilePass: 0,
  provider: DEFAULT_PROVIDER,
  modelByProvider: {},
  plan: DEFAULT_PLAN,
  plusNoticeDismissed: false,
  planPromptsDismissed: {},
  narrationVoice: DEFAULT_NARRATION_VOICE,
  timerSound: DEFAULT_TIMER_SOUND,
  readStepsAloud: true,
  milestones: {},
  showMilestoneCards: true,
  analyticsOptOut: false,
  analyticsOptOutChangedAt: null,
  tagAliases: {},
  topicAliases: {},
  onlyMyKey: false,
  queuePaused: false,
  defaultPlaylistPace: DEFAULT_PLAYLIST_PACE,
  defaultPlaylistOrder: DEFAULT_PLAYLIST_ORDER,
  theme: DEFAULT_THEME_MODE,
  accentColour: DEFAULT_ACCENT_COLOUR,
  headImageSize: DEFAULT_HEAD_IMAGE_SIZE,
  followUpAssistant: null,
  questionsAnsweredHere: true,
  fileIntoProjects: true,
};
