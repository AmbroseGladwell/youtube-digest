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

// Design 16b's rule, in one place: the note is the moment of loss, so it appears only on an
// overview that has just been written, only in the panel that wrote it, and only while the
// overview really is local — syncing belongs to the account, not to a plan
// (docs/architecture/tiers.md). A device that has not heard back is not told its overview is
// local. Dismissing it is permanent — an unasked-for prompt that comes back is worse than
// one that never appeared (docs/features/plus-upsell.md).
export function useSavedLocallyNote(justGenerated: boolean): SavedLocallyNoteState {
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
}
