import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { OverviewId, OverviewState } from "@overview/types";
import { useStores } from "../../../stores/StoresContext.js";
import type { OverviewWithState } from "../types/OverviewWithState.js";
import { overviewKeys } from "../overviewKeys.js";

export interface SetOverviewStateVariables {
  overviewId: OverviewId;
  patch: Partial<Pick<OverviewState, "read" | "favourite">>;
}

interface SetOverviewStateContext {
  previous: OverviewWithState[] | undefined;
}

export function useSetOverviewStateMutation() {
  const { overviewStore } = useStores();
  const queryClient = useQueryClient();

  return useMutation<void, Error, SetOverviewStateVariables, SetOverviewStateContext>({
    mutationKey: overviewKeys.all,
    mutationFn: ({ overviewId, patch }) => overviewStore.setOverviewState(overviewId, patch),

    onMutate: async ({ overviewId, patch }) => {
      await queryClient.cancelQueries({ queryKey: overviewKeys.list() });
      const previous = queryClient.getQueryData<OverviewWithState[]>(overviewKeys.list());
      queryClient.setQueryData<OverviewWithState[]>(overviewKeys.list(), (current) =>
        current?.map((entry) =>
          entry.overview.id === overviewId ? { ...entry, state: { ...entry.state, ...patch } } : entry,
        ),
      );
      return { previous };
    },

    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(overviewKeys.list(), context.previous);
      }
    },

    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: overviewKeys.all }) === 1) {
        void queryClient.invalidateQueries({ queryKey: overviewKeys.list() });
      }
    },
  });
}
