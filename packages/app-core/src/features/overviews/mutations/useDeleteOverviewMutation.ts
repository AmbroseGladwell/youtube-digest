import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { OverviewId } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { libraryEntryId, type LibraryEntry } from "../types/LibraryEntry.js";
import { overviewKeys } from "../overviewKeys.js";

export interface DeleteOverviewVariables {
  overviewId: OverviewId;
}

interface DeleteOverviewContext {
  previousList: LibraryEntry[] | undefined;
}

export function useDeleteOverviewMutation() {
  const { overviewStore } = useStores();
  const queryClient = useQueryClient();

  return useMutation<void, Error, DeleteOverviewVariables, DeleteOverviewContext>({
    mutationKey: overviewKeys.all,
    mutationFn: ({ overviewId }) => overviewStore.deleteOverview(overviewId),

    onMutate: async ({ overviewId }) => {
      await queryClient.cancelQueries({ queryKey: overviewKeys.all });

      const previousList = queryClient.getQueryData<LibraryEntry[]>(overviewKeys.list());

      queryClient.setQueryData<LibraryEntry[]>(overviewKeys.list(), (current) =>
        current?.filter((entry) => libraryEntryId(entry) !== overviewId),
      );

      return { previousList };
    },

    onError: (_error, _variables, context) => {
      if (!context) {
        return;
      }
      queryClient.setQueryData(overviewKeys.list(), context.previousList);
    },

    onSuccess: (_data, { overviewId }) => {
      queryClient.removeQueries({ queryKey: overviewKeys.detail(overviewId) });
    },

    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: overviewKeys.all }) === 1) {
        void queryClient.invalidateQueries({ queryKey: overviewKeys.all });
      }
    },
  });
}
