import {
  MILESTONES,
  PROVIDER_SHORT_LABEL,
  formatTimeSaved,
  modelLabel,
  narrationAccent,
  narrationVoiceName,
  type Provider,
  type NarrationVoice,
  type SectionsEnabled,
} from "@overview/domain";
import { modelFor, type ModelByProvider } from "@overview/domain";
import type { SyncStatus } from "@overview/sync";
import type { AppBuild } from "../../../app/AppBuildContext.js";
import { hasKeyFor, providersWithKeys, type ApiKeys } from "../../apiKeys/ApiKeys.js";
import type { SyncConnection } from "../../sync/types/SyncConnection.js";
import { syncStatusLine } from "../../sync/util/syncStatusLine.js";
import { reachedCount } from "../../timeSaved/util/milestoneTiles.js";
import { ACCENT_GROUP_LABELS } from "./accentGroupLabels.js";
import { OVERVIEW_SECTIONS } from "./overviewSections.js";

export const NOT_SIGNED_IN_ROW_VALUE = "Not signed in";

export function accountRowValue(
  sync: { connected: boolean; status: SyncStatus },
  connection: SyncConnection,
  now: Date,
): string {
  if (!sync.connected) return NOT_SIGNED_IN_ROW_VALUE;
  const name = connection.firstName ?? connection.email;
  const line = syncStatusLine(sync.status, now);
  return name === null ? line : `${name} · ${line}`;
}

export function voiceRowValue(voice: NarrationVoice): string {
  return `${narrationVoiceName(voice)} · ${ACCENT_GROUP_LABELS[narrationAccent(voice)]}`;
}

// Design 110j: the model's name already says who made it, so the row spends its second
// half on how many keys this device holds rather than repeating the provider. The state
// where the choice arrived by sync and the key did not is said in words, because a count
// cannot say it (design 110g).
export function keysRowValue(apiKeys: ApiKeys, provider: Provider, models: ModelByProvider): string {
  const held = providersWithKeys(apiKeys);
  if (held.length === 0) {
    return "No keys yet";
  }

  const name = modelLabel(provider, modelFor(models, provider));
  if (!hasKeyFor(apiKeys, provider)) {
    return `${name} · no ${PROVIDER_SHORT_LABEL[provider]} key here`;
  }
  return held.length === 1 ? `${name} · 1 key` : `${name} · ${held.length} keys`;
}

// "3 shared" or "None": the row says how many links are live without opening the section
// (docs/features/sharing.md).
export function sharedLinksRowValue(count: number): string {
  if (count === 0) return "None";
  return count === 1 ? "1 shared" : `${count} shared`;
}

export function personalisationRowValue(sectionsEnabled: SectionsEnabled, readerContext: string | null): string {
  const on = OVERVIEW_SECTIONS.filter(({ section }) => sectionsEnabled[section]).length;
  const sections =
    on === OVERVIEW_SECTIONS.length
      ? "Every section"
      : on === 0
        ? "Summary and key points only"
        : `${on} of ${OVERVIEW_SECTIONS.length} sections`;
  return `${readerContext ?? "About you not set"} · ${sections}`;
}

export function milestonesRowValue(minutes: number): string {
  return `${formatTimeSaved(minutes)} saved · ${reachedCount(minutes)} of ${MILESTONES.length}`;
}

export function aboutRowValue(build: AppBuild): string {
  return `Version ${build.version}`;
}

// Design 95d: the plan, then what's left of the quota the next overview will use.
export const planRowValue = (plan: string, count: string | null): string =>
  count === null ? plan : `${plan} · ${count}`;
