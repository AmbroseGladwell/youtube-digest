import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { OverviewStore, Topic, TopicMerge } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { overviewKeys } from "../../overviews/overviewKeys.js";
import { topicKeys } from "../../overviews/topicKeys.js";
import type { LibraryEntry } from "../../overviews/types/LibraryEntry.js";
import type { OverviewWithState } from "../../overviews/types/OverviewWithState.js";
import { topicIdsAfter, topicsAfter, type TopicChange } from "../util/topicChange.js";

interface TopicChangeContext {
  previousTopics: Topic[] | undefined;
  previousList: LibraryEntry[] | undefined;
}

const write = async (overviewStore: OverviewStore, change: TopicChange): Promise<TopicMerge[]> => {
  switch (change.kind) {
    case "edit":
      await overviewStore.editTopic(change.id, change.patch);
      return [];
    case "merge": {
      const merges: TopicMerge[] = [];
      for (const from of change.from) {
        const merge = await overviewStore.mergeTopic(from, change.into);
        if (merge !== null) {
          merges.push(merge);
        }
      }
      if (change.patch !== null) {
        await overviewStore.editTopic(change.into, change.patch);
      }
      return merges;
    }
    case "undoMerge":
      if (change.restore !== null) {
        await overviewStore.editTopic(change.into, change.restore);
      }
      for (const merge of [...change.merges].reverse()) {
        await overviewStore.restoreTopic(merge);
      }
      return [];
    case "delete":
      for (const id of change.ids) {
        await overviewStore.deleteTopic(id);
      }
      return [];
  }
};

const refiled = <T extends OverviewWithState>(entry: T, change: TopicChange): T => ({
  ...entry,
  overview: { ...entry.overview, topicIds: topicIdsAfter(entry.overview.id, entry.overview.topicIds, change) },
});

// Painted at once, then written; the store re-files and the server re-files its copies (docs/features/topic-filing.md).
export const useTopicChangeMutation = () => {
  const { overviewStore } = useStores();
  const queryClient = useQueryClient();

  return useMutation<TopicMerge[], Error, TopicChange, TopicChangeContext>({
    mutationKey: overviewKeys.all,
    mutationFn: (change) => write(overviewStore, change),

    onMutate: async (change) => {
      await queryClient.cancelQueries({ queryKey: topicKeys.all });
      await queryClient.cancelQueries({ queryKey: overviewKeys.all });
      const previousTopics = queryClient.getQueryData<Topic[]>(topicKeys.list());
      const previousList = queryClient.getQueryData<LibraryEntry[]>(overviewKeys.list());

      queryClient.setQueryData<Topic[]>(topicKeys.list(), (current) => (current === undefined ? current : topicsAfter(current, change)));
      if (change.kind !== "edit") {
        queryClient.setQueryData<LibraryEntry[]>(overviewKeys.list(), (current) =>
          current?.map((entry) => (entry.kind === "overview" ? refiled(entry, change) : entry)),
        );
        queryClient.setQueriesData<OverviewWithState | null>({ queryKey: [...overviewKeys.all, "detail"] }, (current) =>
          current ? refiled(current, change) : current,
        );
      }
      return { previousTopics, previousList };
    },

    onError: (_error, _change, context) => {
      if (!context) {
        return;
      }
      queryClient.setQueryData(topicKeys.list(), context.previousTopics);
      queryClient.setQueryData(overviewKeys.list(), context.previousList);
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: topicKeys.all });
      if (queryClient.isMutating({ mutationKey: overviewKeys.all }) === 1) {
        void queryClient.invalidateQueries({ queryKey: overviewKeys.all });
      }
    },
  });
};
