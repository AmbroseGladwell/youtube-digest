import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DEFAULT_PROVIDER, modelFor, PROVIDER_SHORT_LABEL, type ArticleRead, type Overview } from "@overview/domain";
import type { OverviewInput } from "@overview/generation";
import { createFetchGenerationApi } from "@overview/sync";
import { useYouTubeFetch } from "../../app/YouTubeFetchContext.js";
import { useStores } from "../../stores/StoresContext.js";
import type { ApiKeys } from "../apiKeys/ApiKeys.js";
import { useErrorReporter } from "../errors/ErrorReporterContext.js";
import { useSettingsQuery } from "../settings/queries/settingsQuery.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { libraryAccountIdOf } from "../sync/types/SyncConnection.js";
import { createGenerationClient, createTranscriptSources } from "./api/generationClients.js";
import { runArticleOverviewGeneration, runOverviewGeneration, type RunOverviewGenerationOptions } from "./api/generationPipeline.js";
import { makeOverviewOnKeys, type OverviewMeta } from "./api/makeOverviewOnKeys.js";
import { createTrialGenerationApi } from "../signedOutTrial/api/createTrialGenerationApi.js";
import { currentSignedOutTrial } from "../signedOutTrial/useSignedOutTrial.js";
import { useOverviewUsageQuery } from "./queries/overviewUsageQuery.js";
import { useGenerationReadiness } from "./useGenerationReadiness.js";
import { keyOrderFor } from "./util/keyOrderFor.js";
import { generationKeys } from "./generationKeys.js";

// Named for the provider the reader chose, not for a provider in particular: on a device
// that holds no key for it, this is the message behind design 110g's dead end.
export const missingKeyMessage = (provider: keyof typeof PROVIDER_SHORT_LABEL): string =>
  `Add your ${PROVIDER_SHORT_LABEL[provider]} API key first.`;

// One generation with everything this shell has to make it: the transcript rungs it can
// ask, the reader's own key and model for the provider they chose, our key, in the order
// the plan sets, and the library to save into. Signed out where there are accounts it is
// onboarding's one overview, on us through the device's trial and never on the reader's key
// (docs/architecture/tiers.md, "Signed out"). Shared by a run the reader starts and by the
// capture queue (docs/features/capture-queue.md).
export function useRunOverviewGeneration(apiKeys: ApiKeys) {
  const { makeWith, settled } = useOverviewMaker(apiKeys);
  const { overviewStore, settingsStore, transcriptStore } = useStores();
  const youTubeFetch = useYouTubeFetch();
  const knownApiUrl = useKnownApiUrl();
  const { connection } = useSyncConnection();
  const reporter = useErrorReporter();
  const signedIn = libraryAccountIdOf(connection) !== null;

  return useCallback(
    async (url: string, options: RunOverviewGenerationOptions): Promise<Overview> =>
      runOverviewGeneration(
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
          makeOverview: makeWith(),
          overviewStore,
          settingsStore,
          transcriptStore,
          warn: (warning) => reporter.warn(warning),
        },
        options,
      ).finally(settled),
    [makeWith, settled, signedIn, knownApiUrl, youTubeFetch, connection.token, overviewStore, settingsStore, transcriptStore, reporter],
  );
}

export function useRunArticleGeneration(apiKeys: ApiKeys) {
  const { makeWith, settled } = useOverviewMaker(apiKeys);
  const { overviewStore, settingsStore } = useStores();

  return useCallback(
    async (read: () => Promise<ArticleRead>, options: RunOverviewGenerationOptions): Promise<Overview> =>
      runArticleOverviewGeneration(read, { makeOverview: makeWith(), overviewStore, settingsStore }, options).finally(settled),
    [makeWith, settled, overviewStore, settingsStore],
  );
}

function useOverviewMaker(apiKeys: ApiKeys) {
  const settingsQuery = useSettingsQuery();
  const knownApiUrl = useKnownApiUrl();
  const { connection } = useSyncConnection();
  const provider = settingsQuery.data?.provider ?? DEFAULT_PROVIDER;
  const model = modelFor(settingsQuery.data?.modelByProvider ?? {}, provider);
  const apiKey = apiKeys.keys[provider]?.key;
  const { ourKeyUsable, accountNeeded } = useGenerationReadiness();
  const plan = useOverviewUsageQuery().data?.plan ?? null;
  const onlyMyKey = settingsQuery.data?.onlyMyKey ?? false;
  const signedIn = libraryAccountIdOf(connection) !== null;
  const queryClient = useQueryClient();

  const makeWith = useCallback(() => {
    const order = keyOrderFor({ ourKeyUsable, plan, hasOwnKey: apiKey !== undefined && !accountNeeded, onlyMyKey });
    if (order.length === 0) {
      throw new Error(missingKeyMessage(provider));
    }
    const keys = {
      order,
      own: apiKey === undefined ? null : { provider, client: createGenerationClient(provider, apiKey, model) },
      api: signedIn && knownApiUrl !== null ? createFetchGenerationApi({ baseUrl: knownApiUrl, token: connection.token }) : null,
      trial: !signedIn && knownApiUrl !== null ? createTrialGenerationApi({ baseUrl: knownApiUrl }) : null,
    };
    return (input: OverviewInput, meta: OverviewMeta) => makeOverviewOnKeys(keys, input, meta);
  }, [apiKey, provider, model, ourKeyUsable, accountNeeded, plan, onlyMyKey, signedIn, knownApiUrl, connection.token]);

  const settled = useCallback(() => void queryClient.invalidateQueries({ queryKey: generationKeys.allUsage() }), [queryClient]);

  return { makeWith, settled };
}
