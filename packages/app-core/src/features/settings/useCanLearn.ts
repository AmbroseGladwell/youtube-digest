import { useGenerationReadiness } from "../newOverview/useGenerationReadiness.js";
import { libraryAccountIdOf } from "../sync/types/SyncConnection.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { useSettingsQuery } from "./queries/settingsQuery.js";

// Whether any key can run the profile pass. Where none can, learning hides itself rather than
// showing a switch that can't work (design 141l).
export function useCanLearn(): boolean {
  const { hasChosenKey, ourKeyUsable } = useGenerationReadiness();
  const { connection } = useSyncConnection();
  const onlyMyKey = useSettingsQuery().data?.onlyMyKey ?? false;
  return hasChosenKey || (ourKeyUsable && !onlyMyKey && libraryAccountIdOf(connection) !== null);
}
