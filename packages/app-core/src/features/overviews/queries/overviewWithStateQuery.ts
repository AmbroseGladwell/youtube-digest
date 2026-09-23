import { queryOptions, useQuery } from "@tanstack/react-query";
import type { OverviewId, OverviewStore } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import type { OverviewWithState } from "../types/OverviewWithState.js";
import { overviewKeys } from "../overviewKeys.js";

export const overviewWithStateQueryOptions = (overviewStore: OverviewStore, overviewId: OverviewId) =>
  queryOptions({
    queryKey: overviewKeys.detail(overviewId),
    queryFn: async (): Promise<OverviewWithState | null> => {
      const overview = await overviewStore.getOverview(overviewId);
      if (!overview) {
        return null;
      }
      return { overview, state: await overviewStore.getOverviewState(overviewId) };
    },
  });

export const useOverviewWithStateQuery = (overviewId: OverviewId) => {
  const { overviewStore } = useStores();
  return useQuery(overviewWithStateQueryOptions(overviewStore, overviewId));
};
