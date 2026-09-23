import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { OverviewId, OverviewState } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import type { OverviewWithState } from "../types/OverviewWithState.js";
import { overviewKeys } from "../overviewKeys.js";

export interface SetOverviewStateVariables {
  overviewId: OverviewId;
  patch: Partial<Pick<OverviewState, "read" | "favourite">>;
}

interface SetOverviewStateContext {
  previousList: OverviewWithState[] | undefined;
  previousDetail: OverviewWithState | null | undefined;
}

export function useSetOverviewStateMutation() {
  const { overviewStore } = useStores();
  const queryClient = useQueryClient();

  return useMutation<void, Error, SetOverviewStateVariables, SetOverviewStateContext>({
    mutationKey: overviewKeys.all,
    mutationFn: ({ overviewId, patch }) => overviewStore.setOverviewState(overviewId, patch),

    onMutate: async ({ overviewId, patch }) => {
      await queryClient.cancelQueries({ queryKey: overviewKeys.all });

      const previousList = queryClient.getQueryData<OverviewWithState[]>(overviewKeys.list());
      const previousDetail = queryClient.getQueryData<OverviewWithState | null>(
        overviewKeys.detail(overviewId),
      );

      queryClient.setQueryData<OverviewWithState[]>(overviewKeys.list(), (current) =>
        current?.map((entry) =>
          entry.overview.id === overviewId ? { ...entry, state: { ...entry.state, ...patch } } : entry,
        ),
      );
      queryClient.setQueryData<OverviewWithState | null>(overviewKeys.detail(overviewId), (current) =>
        current ? { ...current, state: { ...current.state, ...patch } } : current,
      );

      return { previousList, previousDetail };
    },

    onError: (_error, { overviewId }, context) => {
      if (!context) {
        return;
      }
      queryClient.setQueryData(overviewKeys.list(), context.previousList);
      if (context.previousDetail !== undefined) {
        queryClient.setQueryData(overviewKeys.detail(overviewId), context.previousDetail);
      }
    },

    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: overviewKeys.all }) === 1) {
        void queryClient.invalidateQueries({ queryKey: overviewKeys.all });
      }
    },
  });
}
