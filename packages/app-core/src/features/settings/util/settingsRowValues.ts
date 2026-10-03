import {
  ANTHROPIC_MODEL_OPTIONS,
  MILESTONES,
  formatTimeSaved,
  narrationAccent,
  narrationVoiceName,
  type AnthropicModel,
  type NarrationVoice,
} from "@overview/domain";
import type { SyncStatus } from "@overview/sync";
import type { AppBuild } from "../../../app/AppBuildContext.js";
import type { Surface } from "../../../app/SurfaceContext.js";
import { savedHere } from "../../accountLibraries/util/libraryPlace.js";
import type { ApiKeys } from "../../apiKeys/ApiKeys.js";
import type { SyncConnection } from "../../sync/types/SyncConnection.js";
import { syncStatusLine } from "../../sync/util/syncStatusLine.js";
import { reachedCount } from "../../timeSaved/util/milestoneTiles.js";
import { ACCENT_GROUP_LABELS } from "./accentGroupLabels.js";

export const NOT_SIGNED_IN_ROW_VALUE = "Not signed in · this library stays here";

export function accountRowValue(
  sync: { connected: boolean; status: SyncStatus },
  connection: SyncConnection,
  now: Date,
  { signedOutHere, surface }: { signedOutHere: boolean; surface: Surface },
): string {
  if (!sync.connected) return signedOutHere ? `Signed out · saved ${savedHere(surface)}` : NOT_SIGNED_IN_ROW_VALUE;
  const name = connection.firstName ?? connection.email;
  const line = syncStatusLine(sync.status, now);
  return name === null ? line : `${name} · ${line}`;
}

export function voiceRowValue(voice: NarrationVoice): string {
  return `${narrationVoiceName(voice)} · ${ACCENT_GROUP_LABELS[narrationAccent(voice)]}`;
}

export function keysRowValue(apiKeys: ApiKeys, model: AnthropicModel): string {
  const key = apiKeys.anthropicApiKey === null ? "No Anthropic key yet" : "Anthropic key set";
  const modelLabel = ANTHROPIC_MODEL_OPTIONS.find((option) => option.id === model)?.label;
  return modelLabel === undefined ? key : `${key} · ${modelLabel}`;
}

// "3 shared" or "None": the row says how many links are live without opening the section
// (docs/features/sharing.md).
export function sharedLinksRowValue(count: number): string {
  if (count === 0) return "None";
  return count === 1 ? "1 shared" : `${count} shared`;
}

export function milestonesRowValue(minutes: number): string {
  return `${formatTimeSaved(minutes)} saved · ${reachedCount(minutes)} of ${MILESTONES.length}`;
}

export function aboutRowValue(build: AppBuild): string {
  return `Version ${build.version}`;
}
