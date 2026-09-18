import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sameTopicName, type Overview, type Topic } from "@overview/types";
import { useStores } from "../../../stores/StoresContext.js";
import { overviewKeys } from "../overviewKeys.js";
import { topicKeys } from "../topicKeys.js";
import { filedUnderTopic } from "../util/filedUnderTopic.js";

export interface CreateTopicVariables {
  name: string;
  overviews: Overview[];
}

// Find-or-create, and not optimistic, for the reasons in docs/features/topic-filing.md.
export function useCreateTopicMutation() {
  const { overviewStore } = useStores();
  const queryClient = useQueryClient();

  return useMutation<Topic, Error, CreateTopicVariables>({
    mutationKey: overviewKeys.all,
    mutationFn: async ({ name, overviews }) => {
      const trimmed = name.trim();
      const topics = await overviewStore.listTopics();
      const topic =
        topics.find((candidate) => sameTopicName(candidate.name, trimmed)) ??
        (await overviewStore.createTopic({ name: trimmed }));

      for (const overview of overviews) {
        await overviewStore.saveOverview(filedUnderTopic(overview, topic.id));
      }

      return topic;
    },

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: topicKeys.all });
      void queryClient.invalidateQueries({ queryKey: overviewKeys.all });
    },
  });
}
