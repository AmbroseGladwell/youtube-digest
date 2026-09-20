import { useIsPanel } from "../../app/LayoutContext.js";
import { useUpdateSettingsMutation } from "../settings/mutations/useUpdateSettingsMutation.js";
import { useSettingsQuery } from "../settings/queries/settingsQuery.js";
import { usePlan } from "./usePlan.js";

export interface PlusSavedLocallyNoteState {
  shown: boolean;
  dismiss: () => void;
}

// Design 16b's rule, in one place: the note is the moment of loss, so it appears only on
// an overview that has just been written, only in the panel that wrote it, and only
// while there is something Plus would add. Dismissing it is permanent — an unasked-for
// prompt that comes back is worse than one that never appeared
// (docs/features/plus-upsell.md).
export function usePlusSavedLocallyNote(justGenerated: boolean): PlusSavedLocallyNoteState {
  const isPanel = useIsPanel();
  const { isPlus } = usePlan();
  const settingsQuery = useSettingsQuery();
  const updateSettings = useUpdateSettingsMutation();

  return {
    shown: isPanel && !isPlus && justGenerated && settingsQuery.data?.plusNoticeDismissed !== true,
    dismiss: () => updateSettings.mutate({ plusNoticeDismissed: true }),
  };
}
