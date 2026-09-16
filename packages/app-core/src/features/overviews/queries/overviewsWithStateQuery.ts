import { queryOptions, useQuery } from "@tanstack/react-query";
import type { OverviewStore } from "@overview/types";
import { useStores } from "../../../stores/StoresContext.js";
import type { OverviewWithState } from "../types/OverviewWithState.js";
import { overviewKeys } from "../overviewKeys.js";

export const overviewsWithStateQueryOptions = (overviewStore: OverviewStore) =>
  queryOptions({
    queryKey: overviewKeys.list(),
    queryFn: async (): Promise<OverviewWithState[]> => {
      const overviews = await overviewStore.listOverviews();
      const states = await Promise.all(
        overviews.map((overview) => overviewStore.getOverviewState(overview.id)),
      );
      return overviews.map((overview, index) => ({ overview, state: states[index]! }));
    },
  });

export const useOverviewsWithStateQuery = () => {
  const { overviewStore } = useStores();
  return useQuery(overviewsWithStateQueryOptions(overviewStore));
};
