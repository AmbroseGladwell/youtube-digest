import { useCallback } from "react";
import { DEFAULT_PROVIDER, modelFor, PROVIDER_SHORT_LABEL, type Overview } from "@overview/domain";
import { useYouTubeFetch } from "../../app/YouTubeFetchContext.js";
import { useStores } from "../../stores/StoresContext.js";
import type { ApiKeys } from "../apiKeys/ApiKeys.js";
import { useErrorReporter } from "../errors/ErrorReporterContext.js";
import { useSettingsQuery } from "../settings/queries/settingsQuery.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { createGenerationClient, createTranscriptSources } from "./api/generationClients.js";
import { runOverviewGeneration, type RunOverviewGenerationOptions } from "./api/generationPipeline.js";

// Named for the provider the reader chose, not for a provider in particular: on a device
// that holds no key for it, this is the message behind design 110g's dead end.
export const missingKeyMessage = (provider: keyof typeof PROVIDER_SHORT_LABEL): string =>
  `Add your ${PROVIDER_SHORT_LABEL[provider]} API key first.`;

// One generation with everything this shell has to make it: the transcript rungs it can
// ask, the reader's own key and model for the provider they chose, and the library to save
// into. Shared by a run the reader starts and by the capture queue
// (docs/features/capture-queue.md).
export function useRunOverviewGeneration(apiKeys: ApiKeys) {
  const { overviewStore, settingsStore, transcriptStore } = useStores();
  const settingsQuery = useSettingsQuery();
  const youTubeFetch = useYouTubeFetch();
  const knownApiUrl = useKnownApiUrl();
  const { connection } = useSyncConnection();
  const reporter = useErrorReporter();
  const provider = settingsQuery.data?.provider ?? DEFAULT_PROVIDER;
  const model = modelFor(settingsQuery.data?.modelByProvider ?? {}, provider);
  const apiKey = apiKeys.keys[provider]?.key;

  return useCallback(
    async (url: string, options: RunOverviewGenerationOptions): Promise<Overview> => {
      if (apiKey === undefined) {
        throw new Error(missingKeyMessage(provider));
      }
      return runOverviewGeneration(
        url,
        {
          sources: createTranscriptSources({
            sharedCacheApiUrl: knownApiUrl,
            youTubeFetch,
            service: knownApiUrl === null ? null : { apiUrl: knownApiUrl, token: connection.token },
          }),
          generationClient: createGenerationClient(provider, apiKey, model),
          overviewStore,
          settingsStore,
          transcriptStore,
          warn: (warning) => reporter.warn(warning),
        },
        options,
      );
    },
    [apiKey, provider, model, knownApiUrl, youTubeFetch, connection.token, overviewStore, settingsStore, transcriptStore, reporter],
  );
}
