import { isSyncRequestError } from "@overview/sync";
import { useIsPanel } from "../../app/LayoutContext.js";
import { useSessionQuery } from "../auth/queries/sessionQuery.js";
import { useSync } from "../sync/SyncContext.js";
import { useUpdateSettingsMutation } from "../settings/mutations/useUpdateSettingsMutation.js";
import { useSettingsQuery } from "../settings/queries/settingsQuery.js";

export interface SavedLocallyNoteState {
  shown: boolean;
  dismiss: () => void;
}

// When the note shows: docs/features/plus-upsell.md, "16b — after a capture".
export const useSavedLocallyNote = (justGenerated: boolean): SavedLocallyNoteState => {
  const isPanel = useIsPanel();
  const sync = useSync();
  const session = useSessionQuery();
  const settingsQuery = useSettingsQuery();
  const updateSettings = useUpdateSettingsMutation();
  const sessionEnded = isSyncRequestError(session.error) && session.error.code === "unauthenticated";
  const signedIn = sync.connected && !sessionEnded;

  return {
    shown: isPanel && !signedIn && justGenerated && settingsQuery.data?.plusNoticeDismissed !== true,
    dismiss: () => updateSettings.mutate({ plusNoticeDismissed: true }),
  };
};
