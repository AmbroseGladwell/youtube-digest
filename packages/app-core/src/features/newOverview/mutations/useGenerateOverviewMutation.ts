import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Overview } from "@overview/domain";
import { overviewKeys } from "../../overviews/overviewKeys.js";
import { transcriptKeys } from "../../transcripts/transcriptKeys.js";
import { usePlayer } from "../../player/PlayerContext.js";
import { playerTrackFor } from "../../player/types/PlayerTrack.js";
import type { ApiKeys } from "../../apiKeys/ApiKeys.js";
import type { RunOverviewGenerationOptions } from "../api/generationPipeline.js";
import { useRunOverviewGeneration } from "../useRunOverviewGeneration.js";

// The progress and cancellation callbacks travel as variables rather than as hook
// arguments so that the run they belong to is fixed at mutate() time: a second run
// started later must not be able to write into the first one's state.
export interface GenerateOverviewVariables extends RunOverviewGenerationOptions {
  url: string;
}

export function useGenerateOverviewMutation(apiKeys: ApiKeys) {
  const queryClient = useQueryClient();
  const player = usePlayer();
  const generate = useRunOverviewGeneration(apiKeys);

  return useMutation<Overview, Error, GenerateOverviewVariables>({
    mutationKey: overviewKeys.all,
    mutationFn: ({ url, ...options }) => generate(url, options),
    onSuccess: (overview) => {
      player.prepare(playerTrackFor(overview));
      void queryClient.invalidateQueries({ queryKey: overviewKeys.all });
      void queryClient.invalidateQueries({ queryKey: transcriptKeys.all });
    },
  });
}
