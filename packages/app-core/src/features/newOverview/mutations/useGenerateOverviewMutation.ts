import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ArticleRead, Overview } from "@overview/domain";
import { overviewKeys } from "../../overviews/overviewKeys.js";
import { transcriptKeys } from "../../transcripts/transcriptKeys.js";
import { usePlayer } from "../../player/PlayerContext.js";
import { playerTrackFor } from "../../player/types/PlayerTrack.js";
import type { ApiKeys } from "../../apiKeys/ApiKeys.js";
import type { PodcastRunRequest, RunOverviewGenerationOptions } from "../api/generationPipeline.js";
import { useRunArticleGeneration, useRunOverviewGeneration, useRunPodcastGeneration } from "../useRunOverviewGeneration.js";

// The progress and cancellation callbacks travel as variables rather than as hook
// arguments so that the run they belong to is fixed at mutate() time: a second run
// started later must not be able to write into the first one's state.
export type GenerateOverviewVariables = RunOverviewGenerationOptions &
  ({ url: string } | { readArticle: () => Promise<ArticleRead> } | { podcast: PodcastRunRequest });

export function useGenerateOverviewMutation(apiKeys: ApiKeys) {
  const queryClient = useQueryClient();
  const player = usePlayer();
  const generate = useRunOverviewGeneration(apiKeys);
  const generateArticle = useRunArticleGeneration(apiKeys);
  const generatePodcast = useRunPodcastGeneration(apiKeys);

  return useMutation<Overview, Error, GenerateOverviewVariables>({
    mutationKey: overviewKeys.all,
    mutationFn: (variables) => {
      if ("podcast" in variables) {
        const { podcast, ...options } = variables;
        return generatePodcast(podcast, options);
      }
      if ("readArticle" in variables) {
        const { readArticle, ...options } = variables;
        return generateArticle(readArticle, options);
      }
      const { url, ...options } = variables;
      return generate(url, options);
    },
    onSuccess: (overview) => {
      // Only our key's overviews are narrated ahead: one on the reader's own key renders when
      // it is first played, so what narration costs follows what is listened to
      // (docs/architecture/tiers.md, "What an own-key overview costs us").
      if (overview.madeOn?.key === "ours") player.prepare(playerTrackFor(overview));
      void queryClient.invalidateQueries({ queryKey: overviewKeys.all });
      void queryClient.invalidateQueries({ queryKey: transcriptKeys.all });
    },
  });
}
