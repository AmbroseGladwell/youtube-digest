import {
  ANTHROPIC_MODEL_OPTIONS,
  narrationAccent,
  narrationVoiceName,
  type AnthropicModel,
  type NarrationVoice,
} from "@overview/domain";
import type { SyncStatus } from "@overview/sync";
import type { AppBuild } from "../../../app/AppBuildContext.js";
import type { ApiKeys } from "../../apiKeys/ApiKeys.js";
import type { SyncConnection } from "../../sync/types/SyncConnection.js";
import { syncStatusLine } from "../../sync/util/syncStatusLine.js";
import { ACCENT_GROUP_LABELS } from "./accentGroupLabels.js";

export const NOT_SIGNED_IN_ROW_VALUE = "Not signed in · this library stays here";

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

export function keysRowValue(apiKeys: ApiKeys, model: AnthropicModel): string {
  const key = apiKeys.anthropicApiKey === null ? "No Anthropic key yet" : "Anthropic key set";
  const modelLabel = ANTHROPIC_MODEL_OPTIONS.find((option) => option.id === model)?.label;
  return modelLabel === undefined ? key : `${key} · ${modelLabel}`;
}

export function aboutRowValue(build: AppBuild): string {
  return `Version ${build.version}`;
}
