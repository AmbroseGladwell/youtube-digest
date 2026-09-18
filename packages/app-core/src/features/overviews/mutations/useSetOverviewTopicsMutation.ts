import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Overview, TopicId } from "@overview/types";
import { useStores } from "../../../stores/StoresContext.js";
import type { OverviewWithState } from "../types/OverviewWithState.js";
import { overviewKeys } from "../overviewKeys.js";

export interface SetOverviewTopicsVariables {
  overview: Overview;
  topicIds: TopicId[];
}

interface SetOverviewTopicsContext {
  previousList: OverviewWithState[] | undefined;
  previousDetail: OverviewWithState | null | undefined;
}

export function useSetOverviewTopicsMutation() {
  const { overviewStore } = useStores();
  const queryClient = useQueryClient();

  return useMutation<void, Error, SetOverviewTopicsVariables, SetOverviewTopicsContext>({
    mutationKey: overviewKeys.all,
    mutationFn: ({ overview, topicIds }) => overviewStore.saveOverview({ ...overview, topicIds }),

    onMutate: async ({ overview, topicIds }) => {
      await queryClient.cancelQueries({ queryKey: overviewKeys.all });

      const previousList = queryClient.getQueryData<OverviewWithState[]>(overviewKeys.list());
      const previousDetail = queryClient.getQueryData<OverviewWithState | null>(
        overviewKeys.detail(overview.id),
      );

      queryClient.setQueryData<OverviewWithState[]>(overviewKeys.list(), (current) =>
        current?.map((entry) =>
          entry.overview.id === overview.id
            ? { ...entry, overview: { ...entry.overview, topicIds } }
            : entry,
        ),
      );
      queryClient.setQueryData<OverviewWithState | null>(overviewKeys.detail(overview.id), (current) =>
        current ? { ...current, overview: { ...current.overview, topicIds } } : current,
      );

      return { previousList, previousDetail };
    },

    onError: (_error, { overview }, context) => {
      if (!context) {
        return;
      }
      queryClient.setQueryData(overviewKeys.list(), context.previousList);
      if (context.previousDetail !== undefined) {
        queryClient.setQueryData(overviewKeys.detail(overview.id), context.previousDetail);
      }
    },

    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: overviewKeys.all }) === 1) {
        void queryClient.invalidateQueries({ queryKey: overviewKeys.all });
      }
    },
  });
}
