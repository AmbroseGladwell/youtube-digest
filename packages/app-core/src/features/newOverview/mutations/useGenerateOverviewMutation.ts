import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_ANTHROPIC_MODEL, type Overview } from "@overview/types";
import { useStores } from "../../../stores/StoresContext.js";
import { overviewKeys } from "../../overviews/overviewKeys.js";
import { useSettingsQuery } from "../../settings/queries/settingsQuery.js";
import type { ApiKeys } from "../../apiKeys/ApiKeys.js";
import { createGenerationClient, createTranscriptClient } from "../api/generationClients.js";
import { runOverviewGeneration, type GenerationPhase } from "../api/generationPipeline.js";

export interface GenerateOverviewVariables {
  url: string;
}

export function useGenerateOverviewMutation(apiKeys: ApiKeys) {
  const { overviewStore } = useStores();
  const queryClient = useQueryClient();
  const settingsQuery = useSettingsQuery();
  const [phase, setPhase] = useState<GenerationPhase | null>(null);

  const mutation = useMutation<Overview, Error, GenerateOverviewVariables>({
    mutationFn: async ({ url }) => {
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
        setPhase,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: overviewKeys.all });
    },
    onSettled: () => setPhase(null),
  });

  return { ...mutation, phase };
}
