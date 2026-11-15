import { connectionAssistant, followUpAssistantFor, type FollowUpAssistant } from "@overview/domain";
import { useConnectionsQuery } from "../connections/queries/connectionsQuery.js";
import { useUpdateSettingsMutation } from "../settings/mutations/useUpdateSettingsMutation.js";
import { useSettingsQuery } from "../settings/queries/settingsQuery.js";

export interface FollowUpAssistantState {
  // Null until the reader picks one, unless their connections are to one known assistant.
  assistant: FollowUpAssistant | null;
  connectedTo: (assistant: FollowUpAssistant) => boolean;
  anyConnection: boolean;
  choose: (assistant: FollowUpAssistant) => void;
}

// The one synced setting questions open in, which Settings › Connections shares (design 266aa).
// Connections unknown are taken as none, so nothing claims a connection that isn't there.
export function useFollowUpAssistant(): FollowUpAssistantState {
  const chosen = useSettingsQuery().data?.followUpAssistant ?? null;
  const connections = useConnectionsQuery().data ?? [];
  const updateSettings = useUpdateSettingsMutation();
  const { assistant } = followUpAssistantFor(chosen, connections);
  return {
    assistant,
    connectedTo: (each) => connections.some((connection) => connectionAssistant(connection.clientName) === each),
    anyConnection: connections.length > 0,
    choose: (each) => updateSettings.mutate({ followUpAssistant: each }),
  };
}
