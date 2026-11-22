import {
  ACCENT_COLOUR_NAMES,
  firstAboutYouText,
  MILESTONES,
  PROVIDER_SHORT_LABEL,
  THEME_MODE_NAMES,
  formatTimeSaved,
  modelLabel,
  narrationAccent,
  narrationVoiceName,
  type AboutYou,
  type AccentColour,
  type Provider,
  type NarrationVoice,
  type SectionsEnabled,
  type ThemeMode,
  type TimerSound,
  modelFor,
  type ModelByProvider,
} from "@overview/domain";
import type { SyncStatus } from "@overview/sync";
import type { AppBuild } from "../../../app/AppBuildContext.js";
import { TIMER_SOUND_LABELS } from "./timerSoundLabels.js";
import { hasKeyFor, providersWithKeys, type ApiKeys } from "../../apiKeys/ApiKeys.js";
import type { SyncConnection } from "../../sync/types/SyncConnection.js";
import { syncStatusLine } from "../../sync/util/syncStatusLine.js";
import { reachedCount } from "../../timeSaved/util/milestoneTiles.js";
import { capitalised } from "./aboutYouCopy.js";
import { ACCENT_GROUP_LABELS } from "./accentGroupLabels.js";
import { OVERVIEW_SECTIONS } from "./overviewSections.js";

export const NOT_SIGNED_IN_ROW_VALUE = "Not signed in";

export interface AccountSyncState {
  connected: boolean;
  status: SyncStatus;
}

export const accountRowValue = (sync: AccountSyncState, connection: SyncConnection, now: Date): string => {
  if (!sync.connected) {
    return NOT_SIGNED_IN_ROW_VALUE;
  }
  const name = connection.firstName ?? connection.email;
  const line = syncStatusLine(sync.status, now);
  return name === null ? line : `${name} · ${line}`;
};

export const cookingRowValue = (readStepsAloud: boolean, sound: TimerSound): string =>
  `Voice ${readStepsAloud ? "on" : "off"} · ${TIMER_SOUND_LABELS[sound].name}`;

export const voiceRowValue = (voice: NarrationVoice): string => {
  return `${narrationVoiceName(voice)} · ${ACCENT_GROUP_LABELS[narrationAccent(voice)]}`;
};

// A synced choice whose key isn't on this device is said in words, because a count can't say it.
export const keysRowValue = (apiKeys: ApiKeys, provider: Provider, models: ModelByProvider): string => {
  const held = providersWithKeys(apiKeys);
  if (held.length === 0) {
    return "No keys yet";
  }

  const name = modelLabel(provider, modelFor(models, provider));
  if (!hasKeyFor(apiKeys, provider)) {
    return `${name} · no ${PROVIDER_SHORT_LABEL[provider]} key here`;
  }
  return held.length === 1 ? `${name} · 1 key` : `${name} · ${held.length} keys`;
};

export const sharedLinksRowValue = (count: number): string => {
  if (count === 0) {
    return "None";
  }
  return count === 1 ? "1 shared" : `${count} shared`;
};

export interface LearningRowState {
  canLearn: boolean;
  keepLearning: boolean;
  learnedCount: number;
}

const NOT_LEARNING: LearningRowState = { canLearn: false, keepLearning: true, learnedCount: 0 };

const sectionsText = (on: number): string => {
  if (on === OVERVIEW_SECTIONS.length) {
    return "Every section";
  }
  return on === 0 ? "Summary and key points only" : `${on} of ${OVERVIEW_SECTIONS.length} sections`;
};

export const personalisationRowValue = (
  sectionsEnabled: SectionsEnabled,
  aboutYou: AboutYou,
  { canLearn, keepLearning, learnedCount }: LearningRowState = NOT_LEARNING,
): string => {
  const on = OVERVIEW_SECTIONS.filter(({ section }) => sectionsEnabled[section]).length;
  const sections = sectionsText(on);
  const first = firstAboutYouText(aboutYou);
  const lead = first === null ? "About you not set" : capitalised(first);
  if (canLearn && !keepLearning) {
    return `${lead} · Learning off`;
  }
  return canLearn && learnedCount > 0 ? `${lead} · ${learnedCount} learned · ${sections}` : `${lead} · ${sections}`;
};

export const appearanceRowValue = (theme: ThemeMode, accentColour: AccentColour): string => {
  return `${THEME_MODE_NAMES[theme]} · ${ACCENT_COLOUR_NAMES[accentColour]}`;
};

export const milestonesRowValue = (minutes: number): string => {
  return `${formatTimeSaved(minutes)} saved · ${reachedCount(minutes)} of ${MILESTONES.length}`;
};

export const aboutRowValue = (build: AppBuild): string => {
  return `Version ${build.version}`;
};

export const planRowValue = (plan: string, count: string | null, transcribingLeft: string | null = null): string =>
  [plan, count, transcribingLeft === null ? null : `${transcribingLeft} transcribing`].filter((part) => part !== null).join(" · ");
