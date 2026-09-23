import { queryOptions, useQuery } from "@tanstack/react-query";
import type { OverviewStore } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { topicKeys } from "../topicKeys.js";

export const topicsQueryOptions = (overviewStore: OverviewStore) =>
  queryOptions({
    queryKey: topicKeys.list(),
    queryFn: () => overviewStore.listTopics(),
  });

export const useTopicsQuery = () => {
  const { overviewStore } = useStores();
  return useQuery(topicsQueryOptions(overviewStore));
};
