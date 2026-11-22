import { connectionAssistant, followUpAssistantFor, type FollowUpAssistant } from "@overview/domain";
import { useConnectionsQuery } from "../connections/queries/connectionsQuery.js";
import { useUpdateSettingsMutation } from "../settings/mutations/useUpdateSettingsMutation.js";
import { useSettingsQuery } from "../settings/queries/settingsQuery.js";

export interface FollowUpAssistantState {
  assistant: FollowUpAssistant | null;
  answeredHere: boolean;
  connectedTo: (assistant: FollowUpAssistant) => boolean;
  anyConnection: boolean;
  choose: (assistant: FollowUpAssistant, insteadOfHere: boolean) => void;
  chooseHere: () => void;
}

export const useFollowUpAssistant = (): FollowUpAssistantState => {
  const settings = useSettingsQuery().data;
  const chosen = settings?.followUpAssistant ?? null;
  // Connections unknown are taken as none, so nothing claims a connection that isn't there.
  const connections = useConnectionsQuery().data ?? [];
  const updateSettings = useUpdateSettingsMutation();
  const { assistant } = followUpAssistantFor(chosen, connections);
  return {
    assistant,
    answeredHere: settings?.questionsAnsweredHere ?? true,
    connectedTo: (each) => connections.some((connection) => connectionAssistant(connection.clientName) === each),
    anyConnection: connections.length > 0,
    choose: (each, insteadOfHere) =>
      updateSettings.mutate(insteadOfHere ? { followUpAssistant: each, questionsAnsweredHere: false } : { followUpAssistant: each }),
    chooseHere: () => updateSettings.mutate({ questionsAnsweredHere: true }),
  };
};
