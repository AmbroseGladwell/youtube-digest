import { useGenerationReadiness } from "../newOverview/useGenerationReadiness.js";
import { libraryAccountIdOf } from "../sync/types/SyncConnection.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { useSettingsQuery } from "./queries/settingsQuery.js";

export const useCanLearn = (): boolean => {
  const { hasChosenKey, ourKeyUsable } = useGenerationReadiness();
  const { connection } = useSyncConnection();
  const onlyMyKey = useSettingsQuery().data?.onlyMyKey ?? false;
  return hasChosenKey || (ourKeyUsable && !onlyMyKey && libraryAccountIdOf(connection) !== null);
};
