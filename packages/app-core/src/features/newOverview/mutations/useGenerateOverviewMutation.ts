import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ArticleRead, Overview } from "@overview/domain";
import { overviewKeys } from "../../overviews/overviewKeys.js";
import { transcriptKeys } from "../../transcripts/transcriptKeys.js";
import { usePlayer } from "../../player/PlayerContext.js";
import { playerTrackFor } from "../../player/types/PlayerTrack.js";
import type { ApiKeys } from "../../apiKeys/ApiKeys.js";
import type { PodcastRunRequest, RunOverviewGenerationOptions, TikTokRunRequest } from "../api/generationPipeline.js";
import {
  useRunArticleGeneration,
  useRunOverviewGeneration,
  useRunPodcastGeneration,
  useRunTikTokGeneration,
} from "../useRunOverviewGeneration.js";

// Callbacks are variables, fixed at mutate() time, so a later run can't write into this one's state.
export type GenerateOverviewVariables = RunOverviewGenerationOptions &
  ({ url: string } | { readArticle: () => Promise<ArticleRead> } | { podcast: PodcastRunRequest } | { tiktok: TikTokRunRequest });

export const useGenerateOverviewMutation = (apiKeys: ApiKeys) => {
  const queryClient = useQueryClient();
  const player = usePlayer();
  const generate = useRunOverviewGeneration(apiKeys);
  const generateArticle = useRunArticleGeneration(apiKeys);
  const generatePodcast = useRunPodcastGeneration(apiKeys);
  const generateTikTok = useRunTikTokGeneration(apiKeys);

  return useMutation<Overview, Error, GenerateOverviewVariables>({
    mutationKey: overviewKeys.all,
    mutationFn: (variables) => {
      if ("tiktok" in variables) {
        const { tiktok, ...options } = variables;
        return generateTikTok(tiktok.video, tiktok.words, options);
      }
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
      // Only ours is narrated ahead: docs/architecture/tiers.md, "What an own-key overview costs us".
      if (overview.madeOn?.key === "ours") {
        player.prepare(playerTrackFor(overview));
      }
      void queryClient.invalidateQueries({ queryKey: overviewKeys.all });
      void queryClient.invalidateQueries({ queryKey: transcriptKeys.all });
    },
  });
};
