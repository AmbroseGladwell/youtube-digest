import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DEFAULT_PROVIDER, modelFor, PROVIDER_SHORT_LABEL, type ArticleRead, type Overview } from "@overview/domain";
import type { OverviewInput } from "@overview/generation";
import { createFetchGenerationApi, createFetchPodcastApi } from "@overview/sync";
import { podcastTranscript } from "../podcasts/api/podcastTranscript.js";
import { useYouTubeFetch } from "../../app/YouTubeFetchContext.js";
import { useStores, type Stores } from "../../stores/StoresContext.js";
import type { ApiKeys } from "../apiKeys/ApiKeys.js";
import { useErrorReporter } from "../errors/ErrorReporterContext.js";
import { useSettingsQuery } from "../settings/queries/settingsQuery.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { libraryAccountIdOf } from "../sync/types/SyncConnection.js";
import { createGenerationClient, createTranscriptSources } from "./api/generationClients.js";
import {
  runArticleOverviewGeneration,
  runOverviewGeneration,
  runPodcastOverviewGeneration,
  type PodcastRunRequest,
  type RunOverviewGenerationOptions,
} from "./api/generationPipeline.js";
import { makeOverviewOnKeys, type OverviewMeta } from "./api/makeOverviewOnKeys.js";
import { createTrialGenerationApi } from "../signedOutTrial/api/createTrialGenerationApi.js";
import { createTrialPodcastApi } from "../signedOutTrial/api/createTrialPodcastApi.js";
import { currentSignedOutTrial } from "../signedOutTrial/useSignedOutTrial.js";
import { useOurKeyStatusQuery } from "./queries/ourKeyStatusQuery.js";
import { useOverviewUsageQuery } from "./queries/overviewUsageQuery.js";
import { useGenerationReadiness } from "./useGenerationReadiness.js";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { runProfilePassIfDue } from "../settings/api/runProfilePassIfDue.js";
import { settingsKeys } from "../settings/settingsKeys.js";
import { keyOrderFor } from "./util/keyOrderFor.js";
import { generationKeys } from "./generationKeys.js";

// Named for the provider the reader chose, not for a provider in particular: on a device
// that holds no key for it, this is the message behind design 110g's dead end.
export const missingKeyMessage = (provider: keyof typeof PROVIDER_SHORT_LABEL): string =>
  `Add your ${PROVIDER_SHORT_LABEL[provider]} API key first.`;

type RunStores = Pick<Stores, "overviewStore" | "settingsStore" | "transcriptStore">;

// One generation with everything this shell has to make it: the transcript rungs it can
// ask, the reader's own key and model for the provider they chose, our key, in the order
// the plan sets, and the library to save into. Signed out where there are accounts it is
// onboarding's one overview, on us through the device's trial and never on the reader's key
// (docs/architecture/tiers.md, "Signed out"). Shared by a run the reader starts and by the
// capture queue (docs/features/capture-queue.md). The library is the one shown, unless the
// run brings its own: onboarding's keeps writing where it started once the reader signs in
// (docs/features/onboarding.md, "Into the account").
export function useRunOverviewGeneration(apiKeys: ApiKeys) {
  const { makeWith, learnFrom, settled } = useOverviewMaker(apiKeys);
  const shown = useStores();
  const youTubeFetch = useYouTubeFetch();
  const knownApiUrl = useKnownApiUrl();
  const { connection } = useSyncConnection();
  const reporter = useErrorReporter();
  const signedIn = libraryAccountIdOf(connection) !== null;

  return useCallback(
    async (url: string, options: RunOverviewGenerationOptions, stores: RunStores = shown): Promise<Overview> =>
      runOverviewGeneration(
        url,
        {
          sources: createTranscriptSources({
            youTubeFetch,
            service:
              knownApiUrl === null
                ? null
                : { apiUrl: knownApiUrl, token: connection.token, trialToken: signedIn ? null : currentSignedOutTrial().token },
          }),
          makeOverview: makeWith(),
          overviewStore: stores.overviewStore,
          settingsStore: stores.settingsStore,
          transcriptStore: stores.transcriptStore,
          warn: (warning) => reporter.warn(warning),
          timed: (timing) => reporter.time(timing),
        },
        options,
      )
        .then((overview) => learnFrom(overview, stores))
        .finally(settled),
    [makeWith, learnFrom, settled, signedIn, knownApiUrl, youTubeFetch, connection.token, shown, reporter],
  );
}

export function useRunArticleGeneration(apiKeys: ApiKeys) {
  const { makeWith, learnFrom, settled } = useOverviewMaker(apiKeys);
  const shown = useStores();

  return useCallback(
    async (read: () => Promise<ArticleRead>, options: RunOverviewGenerationOptions, stores: RunStores = shown): Promise<Overview> =>
      runArticleOverviewGeneration(
        read,
        { makeOverview: makeWith(), overviewStore: stores.overviewStore, settingsStore: stores.settingsStore },
        options,
      )
        .then((overview) => learnFrom(overview, stores))
        .finally(settled),
    [makeWith, learnFrom, settled, shown],
  );
}

// An episode's words come through our server, on the account or signed out on the trial; the reader's
// extension searches YouTube for the episode on their own connection when it can
// (docs/features/podcast-on-youtube.md).
export function useRunPodcastGeneration(apiKeys: ApiKeys) {
  const { makeWith, learnFrom, settled } = useOverviewMaker(apiKeys);
  const shown = useStores();
  const youTubeFetch = useYouTubeFetch();
  const knownApiUrl = useKnownApiUrl();
  const { connection } = useSyncConnection();
  const signedIn = libraryAccountIdOf(connection) !== null;

  return useCallback(
    async (request: PodcastRunRequest, options: RunOverviewGenerationOptions, stores: RunStores = shown): Promise<Overview> => {
      if (knownApiUrl === null) throw new Error("Episodes are read through our server, and there isn't one here");
      const api = signedIn
        ? createFetchPodcastApi({ baseUrl: knownApiUrl, token: connection.token })
        : createTrialPodcastApi({ baseUrl: knownApiUrl });
      return runPodcastOverviewGeneration(
        request,
        (episode) => podcastTranscript(api, episode, youTubeFetch),
        {
          makeOverview: makeWith(),
          overviewStore: stores.overviewStore,
          settingsStore: stores.settingsStore,
          transcriptStore: stores.transcriptStore,
        },
        options,
      )
        .then((overview) => learnFrom(overview, stores))
        .finally(settled);
    },
    [makeWith, learnFrom, settled, shown, knownApiUrl, connection.token, youTubeFetch, signedIn],
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
  const ourKeyStatus = useOurKeyStatusQuery().data;
  const ourProvider = ourKeyStatus?.provider;
  const ourModelId = ourKeyStatus?.model;

  const analytics = useAnalytics();

  const keysNow = useCallback(() => {
    const order = keyOrderFor({ ourKeyUsable, plan, hasOwnKey: apiKey !== undefined && !accountNeeded, onlyMyKey });
    if (order.length === 0) {
      throw new Error(missingKeyMessage(provider));
    }
    return {
      order,
      own: apiKey === undefined ? null : { provider, model, client: createGenerationClient(provider, apiKey, model) },
      api: signedIn && knownApiUrl !== null ? createFetchGenerationApi({ baseUrl: knownApiUrl, token: connection.token }) : null,
      trial: !signedIn && knownApiUrl !== null ? createTrialGenerationApi({ baseUrl: knownApiUrl }) : null,
      ourModel: ourProvider === undefined || ourModelId === undefined ? null : { provider: ourProvider, model: ourModelId },
    };
  }, [
    apiKey,
    provider,
    model,
    ourKeyUsable,
    accountNeeded,
    plan,
    onlyMyKey,
    signedIn,
    knownApiUrl,
    connection.token,
    ourProvider,
    ourModelId,
  ]);

  const makeWith = useCallback(() => {
    const keys = keysNow();
    return (input: OverviewInput, meta: OverviewMeta) => makeOverviewOnKeys(keys, input, meta);
  }, [keysNow]);

  const learnFrom = useCallback(
    (overview: Overview, { overviewStore, settingsStore }: Pick<Stores, "overviewStore" | "settingsStore">): Overview => {
      const keys = keysNow();
      void runProfilePassIfDue({
        madeOn: overview.madeOn?.key ?? null,
        own: keys.own?.client ?? null,
        api: keys.api,
        overviewStore,
        settingsStore,
        analytics,
      }).then((ran) => {
        if (ran) void queryClient.invalidateQueries({ queryKey: settingsKeys.all });
      });
      return overview;
    },
    [keysNow, analytics, queryClient],
  );

  const settled = useCallback(() => void queryClient.invalidateQueries({ queryKey: generationKeys.allUsage() }), [queryClient]);

  return { makeWith, learnFrom, settled };
}
