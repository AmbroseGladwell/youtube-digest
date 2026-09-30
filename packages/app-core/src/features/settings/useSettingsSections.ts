import { DEFAULT_ANTHROPIC_MODEL, DEFAULT_NARRATION_VOICE } from "@overview/domain";
import { useAppBuild } from "../../app/AppBuildContext.js";
import { useApiKeys } from "../apiKeys/useApiKeys.js";
import { useConnectionsQuery } from "../connections/queries/connectionsQuery.js";
import { connectionsRowValue } from "../connections/util/connectionsRowValue.js";
import { useNarrationApi } from "../player/NarrationApiContext.js";
import { PLAN_LABEL } from "../plus/planLabel.js";
import { usePlan } from "../plus/usePlan.js";
import { useSync } from "../sync/SyncContext.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { useSettingsQuery } from "./queries/settingsQuery.js";
import type { SettingsSectionId } from "./SettingsSectionId.js";
import { aboutRowValue, accountRowValue, keysRowValue, voiceRowValue } from "./util/settingsRowValues.js";

export interface SettingsSectionSummary {
  id: SettingsSectionId;
  title: string;
  value: string;
}

// The sections this shell can show, in the design's order (docs/features/settings.md). A
// section whose panel would have nothing to show is left out, row and route alike.
export function useSettingsSections(): SettingsSectionSummary[] {
  const sync = useSync();
  const { connection } = useSyncConnection();
  const narrationApi = useNarrationApi();
  const settings = useSettingsQuery().data;
  const { apiKeys } = useApiKeys();
  const { plan, isPlus } = usePlan();
  const connections = useConnectionsQuery();
  const build = useAppBuild();

  return [
    ...(sync.available
      ? [{ id: "account" as const, title: "Account & sync", value: accountRowValue(sync, connection, new Date()) }]
      : []),
    ...(narrationApi !== null
      ? [
          {
            id: "voice" as const,
            title: "Narration voice",
            value: voiceRowValue(settings?.narrationVoice ?? DEFAULT_NARRATION_VOICE),
          },
        ]
      : []),
    { id: "keys", title: "API keys", value: keysRowValue(apiKeys, settings?.model ?? DEFAULT_ANTHROPIC_MODEL) },
    ...(sync.available
      ? [
          {
            id: "connections" as const,
            title: "Connections",
            value: connectionsRowValue({ signedIn: sync.connected, isPlus, count: connections.data?.length }),
          },
        ]
      : []),
    { id: "plan", title: "Plan", value: PLAN_LABEL[plan] },
    ...(build !== null ? [{ id: "about" as const, title: "About", value: aboutRowValue(build) }] : []),
  ];
}
