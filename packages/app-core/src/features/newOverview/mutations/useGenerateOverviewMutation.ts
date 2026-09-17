import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_ANTHROPIC_MODEL, type Overview } from "@overview/types";
import { useStores } from "../../../stores/StoresContext.js";
import { overviewKeys } from "../../overviews/overviewKeys.js";
import { useSettingsQuery } from "../../settings/queries/settingsQuery.js";
import type { ApiKeys } from "../../apiKeys/ApiKeys.js";
import { createGenerationClient, createTranscriptClient } from "../api/generationClients.js";
import { runOverviewGeneration, type RunOverviewGenerationOptions } from "../api/generationPipeline.js";

// The progress and cancellation callbacks travel as variables rather than as hook
// arguments so that the run they belong to is fixed at mutate() time: a second run
// started later must not be able to write into the first one's state.
export interface GenerateOverviewVariables extends RunOverviewGenerationOptions {
  url: string;
}

export function useGenerateOverviewMutation(apiKeys: ApiKeys) {
  const { overviewStore } = useStores();
  const queryClient = useQueryClient();
  const settingsQuery = useSettingsQuery();

  return useMutation<Overview, Error, GenerateOverviewVariables>({
    mutationKey: overviewKeys.all,
    mutationFn: async ({ url, onProgress, isCancelled }) => {
      if (!apiKeys.anthropicApiKey || !apiKeys.supadataApiKey) {
        throw new Error("Add your Anthropic and Supadata API keys first.");
      }
      return runOverviewGeneration(
        url,
        {
          transcriptClient: createTranscriptClient(apiKeys.supadataApiKey),
          generationClient: createGenerationClient(
            apiKeys.anthropicApiKey,
            settingsQuery.data?.model ?? DEFAULT_ANTHROPIC_MODEL,
          ),
          overviewStore,
        },
        { onProgress, isCancelled },
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: overviewKeys.all });
    },
  });
}
