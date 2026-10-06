import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Settings } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { overviewKeys } from "../../overviews/overviewKeys.js";
import type { LibraryEntry } from "../../overviews/types/LibraryEntry.js";
import type { OverviewWithState } from "../../overviews/types/OverviewWithState.js";
import { settingsKeys } from "../../settings/settingsKeys.js";
import { applyTagEditPlan, type TagEditPlan } from "../util/planTagEdit.js";

interface EditTagsContext {
  previousList: LibraryEntry[] | undefined;
  previousSettings: Settings | undefined;
}

// One merge, rename, delete or undo: every note's new tags as its own synced field write, then
// the aliases (docs/features/tag-reuse.md, "Merge and rename rewrite the notes").
export function useEditTagsMutation() {
  const { overviewStore, settingsStore } = useStores();
  const queryClient = useQueryClient();

  return useMutation<void, Error, TagEditPlan, EditTagsContext>({
    mutationKey: overviewKeys.all,
    mutationFn: async ({ writes, aliases }) => {
      for (const { overviewId, tags, userTags } of writes) {
        if (tags !== undefined) await overviewStore.setOverviewTags(overviewId, tags);
        if (userTags !== undefined) await overviewStore.setOverviewState(overviewId, { userTags });
      }
      await settingsStore.update({ tagAliases: aliases });
    },

    onMutate: async (plan) => {
      await queryClient.cancelQueries({ queryKey: overviewKeys.all });
      await queryClient.cancelQueries({ queryKey: settingsKeys.all });
      const previousList = queryClient.getQueryData<LibraryEntry[]>(overviewKeys.list());
      const previousSettings = queryClient.getQueryData<Settings>(settingsKeys.all);

      queryClient.setQueryData<LibraryEntry[]>(overviewKeys.list(), (current) =>
        current?.map((entry) => (entry.kind === "overview" ? applyTagEditPlan(entry, plan) : entry)),
      );
      for (const { overviewId } of plan.writes) {
        queryClient.setQueryData<OverviewWithState | null>(overviewKeys.detail(overviewId), (current) =>
          current ? applyTagEditPlan(current, plan) : current,
        );
      }
      queryClient.setQueryData<Settings>(settingsKeys.all, (current) =>
        current ? { ...current, tagAliases: plan.aliases } : current,
      );

      return { previousList, previousSettings };
    },

    onError: (_error, _plan, context) => {
      if (!context) return;
      queryClient.setQueryData(overviewKeys.list(), context.previousList);
      if (context.previousSettings) queryClient.setQueryData(settingsKeys.all, context.previousSettings);
      void queryClient.invalidateQueries({ queryKey: overviewKeys.all });
    },

    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: overviewKeys.all }) === 1) {
        void queryClient.invalidateQueries({ queryKey: overviewKeys.all });
        void queryClient.invalidateQueries({ queryKey: settingsKeys.all });
      }
    },
  });
}
