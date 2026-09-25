import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Overview } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import type { LibraryEntry } from "../types/LibraryEntry.js";
import type { OverviewWithState } from "../types/OverviewWithState.js";
import { overviewKeys } from "../overviewKeys.js";

export interface SetOverviewCaptureReasonVariables {
  overview: Overview;
  captureReason: string | null;
}

interface SetOverviewCaptureReasonContext {
  previousList: LibraryEntry[] | undefined;
  previousDetail: OverviewWithState | null | undefined;
}

export function useSetOverviewCaptureReasonMutation() {
  const { overviewStore } = useStores();
  const queryClient = useQueryClient();

  return useMutation<void, Error, SetOverviewCaptureReasonVariables, SetOverviewCaptureReasonContext>({
    mutationKey: overviewKeys.all,
    mutationFn: ({ overview, captureReason }) =>
      overviewStore.setOverviewCaptureReason(overview.id, captureReason),

    onMutate: async ({ overview, captureReason }) => {
      await queryClient.cancelQueries({ queryKey: overviewKeys.all });

      const previousList = queryClient.getQueryData<LibraryEntry[]>(overviewKeys.list());
      const previousDetail = queryClient.getQueryData<OverviewWithState | null>(
        overviewKeys.detail(overview.id),
      );

      queryClient.setQueryData<LibraryEntry[]>(overviewKeys.list(), (current) =>
        current?.map((entry) =>
          entry.kind === "overview" && entry.overview.id === overview.id
            ? { ...entry, overview: { ...entry.overview, captureReason } }
            : entry,
        ),
      );
      queryClient.setQueryData<OverviewWithState | null>(overviewKeys.detail(overview.id), (current) =>
        current ? { ...current, overview: { ...current.overview, captureReason } } : current,
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
