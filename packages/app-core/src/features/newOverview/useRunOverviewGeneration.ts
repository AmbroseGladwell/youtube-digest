import { useCallback } from "react";
import { DEFAULT_ANTHROPIC_MODEL, type Overview } from "@overview/domain";
import { useYouTubeFetch } from "../../app/YouTubeFetchContext.js";
import { useStores } from "../../stores/StoresContext.js";
import type { ApiKeys } from "../apiKeys/ApiKeys.js";
import { useErrorReporter } from "../errors/ErrorReporterContext.js";
import { useSettingsQuery } from "../settings/queries/settingsQuery.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { createGenerationClient, createTranscriptSources } from "./api/generationClients.js";
import { runOverviewGeneration, type RunOverviewGenerationOptions } from "./api/generationPipeline.js";

export const MISSING_ANTHROPIC_KEY = "Add your Anthropic API key first.";

// One generation with everything this shell has to make it: the transcript rungs it can
// ask, the reader's own key and model, and the library to save into. Shared by a run the
// reader starts and by the capture queue (docs/features/capture-queue.md).
export function useRunOverviewGeneration(apiKeys: ApiKeys) {
  const { overviewStore, transcriptStore } = useStores();
  const settingsQuery = useSettingsQuery();
  const youTubeFetch = useYouTubeFetch();
  const knownApiUrl = useKnownApiUrl();
  const { connection } = useSyncConnection();
  const reporter = useErrorReporter();
  const model = settingsQuery.data?.model ?? DEFAULT_ANTHROPIC_MODEL;

  return useCallback(
    async (url: string, options: RunOverviewGenerationOptions): Promise<Overview> => {
      if (!apiKeys.anthropicApiKey) {
        throw new Error(MISSING_ANTHROPIC_KEY);
      }
      return runOverviewGeneration(
        url,
        {
          sources: createTranscriptSources({
            sharedCacheApiUrl: knownApiUrl,
            youTubeFetch,
            service: knownApiUrl === null ? null : { apiUrl: knownApiUrl, token: connection.token },
          }),
          generationClient: createGenerationClient(apiKeys.anthropicApiKey, model),
          overviewStore,
          transcriptStore,
          warn: (warning) => reporter.warn(warning),
        },
        options,
      );
    },
    [apiKeys.anthropicApiKey, knownApiUrl, youTubeFetch, connection.token, model, overviewStore, transcriptStore, reporter],
  );
}
