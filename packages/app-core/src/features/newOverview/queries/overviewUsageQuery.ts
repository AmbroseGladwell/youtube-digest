import { useQuery } from "@tanstack/react-query";
import type { OverviewUsage } from "@overview/domain";
import { createFetchGenerationApi } from "@overview/sync";
import { isConnected, libraryAccountIdOf } from "../../sync/types/SyncConnection.js";
import { useKnownApiUrl } from "../../sync/useKnownApiUrl.js";
import { useSyncConnection } from "../../sync/useSyncConnection.js";
import { generationKeys } from "../generationKeys.js";

// The signed-in account's plan and this month's counts on each key, as the server keeps
// them. Signed out there is no account to ask about.
export function useOverviewUsageQuery() {
  const apiUrl = useKnownApiUrl();
  const { connection } = useSyncConnection();
  const accountId = libraryAccountIdOf(connection);
  return useQuery({
    queryKey: generationKeys.usage(accountId),
    queryFn: (): Promise<OverviewUsage> =>
      createFetchGenerationApi({ baseUrl: apiUrl!, token: connection.token }).usage(),
    enabled: isConnected(connection) && apiUrl !== null,
    staleTime: 60 * 1000,
    retry: false,
  });
}
