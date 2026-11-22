import { connectionAssistant, followUpAssistantFor, type FollowUpAssistant } from "@overview/domain";
import { useConnectionsQuery } from "../connections/queries/connectionsQuery.js";
import { useUpdateSettingsMutation } from "../settings/mutations/useUpdateSettingsMutation.js";
import { useSettingsQuery } from "../settings/queries/settingsQuery.js";

export interface FollowUpAssistantState {
  // Null until the reader picks one, unless their connections are to one known assistant.
  assistant: FollowUpAssistant | null;
  // Where chat is offered, whether a tapped question is answered in the app (design 310f).
  answeredHere: boolean;
  connectedTo: (assistant: FollowUpAssistant) => boolean;
  anyConnection: boolean;
  // Chosen where Here was offered, it also stops questions being answered here; chosen where
  // chat is hidden, it leaves that alone.
  choose: (assistant: FollowUpAssistant, insteadOfHere: boolean) => void;
  chooseHere: () => void;
}

// The one synced setting questions open in, which Settings › Connections shares (designs 266aa,
// 310f). Connections unknown are taken as none, so nothing claims a connection that isn't there.
export const useFollowUpAssistant = (): FollowUpAssistantState => {
  const settings = useSettingsQuery().data;
  const chosen = settings?.followUpAssistant ?? null;
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
