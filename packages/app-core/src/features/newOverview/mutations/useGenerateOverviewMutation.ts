import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_ANTHROPIC_MODEL, type Overview } from "@overview/domain";
import { useStores } from "../../../stores/StoresContext.js";
import { useYouTubeFetch } from "../../../app/YouTubeFetchContext.js";
import { overviewKeys } from "../../overviews/overviewKeys.js";
import { transcriptKeys } from "../../transcripts/transcriptKeys.js";
import { useKnownApiUrl } from "../../sync/useKnownApiUrl.js";
import { useSettingsQuery } from "../../settings/queries/settingsQuery.js";
import { usePlayer } from "../../player/PlayerContext.js";
import { useErrorReporter } from "../../errors/ErrorReporterContext.js";
import { playerTrackFor } from "../../player/types/PlayerTrack.js";
import type { ApiKeys } from "../../apiKeys/ApiKeys.js";
import { createGenerationClient, createTranscriptSources } from "../api/generationClients.js";
import { runOverviewGeneration, type RunOverviewGenerationOptions } from "../api/generationPipeline.js";

// The progress and cancellation callbacks travel as variables rather than as hook
// arguments so that the run they belong to is fixed at mutate() time: a second run
// started later must not be able to write into the first one's state.
export interface GenerateOverviewVariables extends RunOverviewGenerationOptions {
  url: string;
}

export function useGenerateOverviewMutation(apiKeys: ApiKeys) {
  const { overviewStore, transcriptStore } = useStores();
  const queryClient = useQueryClient();
  const settingsQuery = useSettingsQuery();
  const youTubeFetch = useYouTubeFetch();
  const knownApiUrl = useKnownApiUrl();
  const player = usePlayer();
  const reporter = useErrorReporter();

  return useMutation<Overview, Error, GenerateOverviewVariables>({
    mutationKey: overviewKeys.all,
    mutationFn: async ({ url, onProgress, isCancelled, overviewId, captureReason }) => {
      if (!apiKeys.anthropicApiKey) {
        throw new Error("Add your Anthropic API key first.");
      }
      return runOverviewGeneration(
        url,
        {
          sources: createTranscriptSources({
            sharedCacheApiUrl: knownApiUrl,
            youTubeFetch,
            supadataApiKey: apiKeys.supadataApiKey,
          }),
          generationClient: createGenerationClient(
            apiKeys.anthropicApiKey,
            settingsQuery.data?.model ?? DEFAULT_ANTHROPIC_MODEL,
          ),
          overviewStore,
          transcriptStore,
          warn: (warning) => reporter.warn(warning),
        },
        { onProgress, isCancelled, overviewId, captureReason },
      );
    },
    onSuccess: (overview) => {
      player.prepare(playerTrackFor(overview));
      void queryClient.invalidateQueries({ queryKey: overviewKeys.all });
      void queryClient.invalidateQueries({ queryKey: transcriptKeys.all });
    },
  });
}
