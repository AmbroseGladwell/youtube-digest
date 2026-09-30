import { queryOptions, useQuery } from "@tanstack/react-query";
import type { OverviewId, SyncStorage } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { overviewKeys } from "../../overviews/overviewKeys.js";

// Whether the server holds a revision of this note, pushed from here or pulled from another
// device. Under overviewKeys so that every pull the sync runtime applies asks again.
export const overviewSyncedQueryOptions = (syncStorage: SyncStorage, overviewId: OverviewId) =>
  queryOptions({
    queryKey: overviewKeys.synced(overviewId),
    queryFn: async () => (await syncStorage.revisionOf("overview", overviewId)) !== null,
  });

export const useOverviewSyncedQuery = (overviewId: OverviewId, enabled: boolean) => {
  const { syncStorage } = useStores();
  return useQuery({
    ...overviewSyncedQueryOptions(syncStorage!, overviewId),
    enabled: enabled && syncStorage !== null,
  });
};
