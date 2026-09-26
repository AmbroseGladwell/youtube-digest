import { queryOptions, useQuery } from "@tanstack/react-query";
import type { OverviewStore } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { overviewKeys } from "../../overviews/overviewKeys.js";

export const unreadableRecordsQueryOptions = (overviewStore: OverviewStore) =>
  queryOptions({
    queryKey: overviewKeys.unreadable(),
    queryFn: () => overviewStore.listUnreadable(),
  });

export const useUnreadableRecordsQuery = () => {
  const { overviewStore } = useStores();
  return useQuery(unreadableRecordsQueryOptions(overviewStore));
};
