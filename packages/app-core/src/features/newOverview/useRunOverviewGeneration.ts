import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DEFAULT_PROVIDER, modelFor, PROVIDER_SHORT_LABEL, TRIAL_OVERVIEWS, type Overview } from "@overview/domain";
import { createFetchGenerationApi } from "@overview/sync";
import { useYouTubeFetch } from "../../app/YouTubeFetchContext.js";
import { useStores } from "../../stores/StoresContext.js";
import type { ApiKeys } from "../apiKeys/ApiKeys.js";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { useErrorReporter } from "../errors/ErrorReporterContext.js";
import { useSettingsQuery } from "../settings/queries/settingsQuery.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { libraryAccountIdOf } from "../sync/types/SyncConnection.js";
import { createGenerationClient, createTranscriptSources } from "./api/generationClients.js";
import { runOverviewGeneration, type RunOverviewGenerationOptions } from "./api/generationPipeline.js";
import { makeOverviewOnKeys } from "./api/makeOverviewOnKeys.js";
import { createTrialGenerationApi } from "../signedOutTrial/api/createTrialGenerationApi.js";
import { countSignedOutOverview, currentSignedOutTrial } from "../signedOutTrial/useSignedOutTrial.js";
import { TRIAL_SPENT_MESSAGE } from "../signedOutTrial/trialPrompt.js";
import { useOverviewUsageQuery } from "./queries/overviewUsageQuery.js";
import { useGenerationReadiness } from "./useGenerationReadiness.js";
import { keyOrderFor } from "./util/keyOrderFor.js";
import { generationKeys } from "./generationKeys.js";

// Named for the provider the reader chose, not for a provider in particular: on a device
// that holds no key for it, this is the message behind design 110g's dead end.
export const missingKeyMessage = (provider: keyof typeof PROVIDER_SHORT_LABEL): string =>
  `Add your ${PROVIDER_SHORT_LABEL[provider]} API key first.`;

// One generation with everything this shell has to make it: the transcript rungs it can
// ask, the reader's own key and model for the provider they chose, our key when the account
// or the signed-out trial can use it, in the order the plan sets, and the library to save
// into. Signed out, every overview made counts towards the trial, on either key. Shared by a run the reader starts and by the capture queue
// (docs/features/capture-queue.md).
export function useRunOverviewGeneration(apiKeys: ApiKeys) {
  const { overviewStore, settingsStore, transcriptStore } = useStores();
  const settingsQuery = useSettingsQuery();
  const youTubeFetch = useYouTubeFetch();
  const knownApiUrl = useKnownApiUrl();
  const { connection } = useSyncConnection();
  const reporter = useErrorReporter();
  const analytics = useAnalytics();
  const provider = settingsQuery.data?.provider ?? DEFAULT_PROVIDER;
  const model = modelFor(settingsQuery.data?.modelByProvider ?? {}, provider);
  const apiKey = apiKeys.keys[provider]?.key;
  const { ourKeyUsable, trialSpent } = useGenerationReadiness();
  const plan = useOverviewUsageQuery().data?.plan ?? null;
  const onlyMyKey = settingsQuery.data?.onlyMyKey ?? false;
  const signedIn = libraryAccountIdOf(connection) !== null;
  const queryClient = useQueryClient();

  return useCallback(
    async (url: string, options: RunOverviewGenerationOptions): Promise<Overview> => {
      if (trialSpent) {
        throw new Error(TRIAL_SPENT_MESSAGE);
      }
      const order = keyOrderFor({ ourKeyUsable, plan, hasOwnKey: apiKey !== undefined, onlyMyKey });
      if (order.length === 0) {
        throw new Error(missingKeyMessage(provider));
      }
      const keys = {
        order,
        own: apiKey === undefined ? null : { provider, client: createGenerationClient(provider, apiKey, model) },
        api: signedIn && knownApiUrl !== null ? createFetchGenerationApi({ baseUrl: knownApiUrl, token: connection.token }) : null,
        trial: !signedIn && knownApiUrl !== null ? createTrialGenerationApi({ baseUrl: knownApiUrl }) : null,
      };
      const overview = await runOverviewGeneration(
        url,
        {
          sources: createTranscriptSources({
            sharedCacheApiUrl: knownApiUrl,
            youTubeFetch,
            service:
              knownApiUrl === null
                ? null
                : { apiUrl: knownApiUrl, token: connection.token, trialToken: signedIn ? null : currentSignedOutTrial().token },
          }),
          makeOverview: (input, meta) => makeOverviewOnKeys(keys, input, meta),
          overviewStore,
          settingsStore,
          transcriptStore,
          warn: (warning) => reporter.warn(warning),
        },
        options,
      ).finally(() => void queryClient.invalidateQueries({ queryKey: generationKeys.allUsage() }));
      if (!signedIn) {
        countSignedOutOverview();
        if (currentSignedOutTrial().made === TRIAL_OVERVIEWS) analytics.account.trial.limitReached();
      }
      return overview;
    },
    [
      apiKey,
      provider,
      model,
      ourKeyUsable,
      trialSpent,
      plan,
      onlyMyKey,
      signedIn,
      knownApiUrl,
      youTubeFetch,
      connection.token,
      overviewStore,
      settingsStore,
      transcriptStore,
      reporter,
      analytics,
      queryClient,
    ],
  );
}
