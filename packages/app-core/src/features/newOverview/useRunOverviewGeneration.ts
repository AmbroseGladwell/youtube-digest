import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DEFAULT_PROVIDER, modelFor, PROVIDER_SHORT_LABEL, type ArticleRead, type Overview } from "@overview/domain";
import type { OverviewInput } from "@overview/generation";
import { createFetchGenerationApi, createFetchPodcastApi } from "@overview/sync";
import { podcastTranscript } from "../podcasts/api/podcastTranscript.js";
import { transcribeEpisode, type TranscriptionProgress } from "../podcasts/api/transcribeEpisode.js";
import { EpisodeNeedsTranscribingError } from "../podcasts/api/EpisodeNeedsTranscribingError.js";
import { TranscriptionFailedError } from "../podcasts/api/TranscriptionFailedError.js";
import { TranscriptionRefusedError } from "../podcasts/api/TranscriptionRefusedError.js";
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

type RunStores = Pick<Stores, "overviewStore" | "settingsStore" | "transcriptStore"> & Partial<Pick<Stores, "projectStore">>;

// One generation with everything this shell has to make it: the transcript rungs it can
// ask, the reader's own key and model for the provider they chose, our key, in the order
// the plan sets, and the library to save into. Nothing is made signed out where there are accounts
// (docs/architecture/tiers.md, "Signed out"). Shared by a run the reader starts and by the
// capture queue (docs/features/capture-queue.md). The library is the one shown, unless the
// run brings its own.
export function useRunOverviewGeneration(apiKeys: ApiKeys) {
  const { makeWith, learnFrom, settled } = useOverviewMaker(apiKeys);
  const shown = useStores();
  const youTubeFetch = useYouTubeFetch();
  const knownApiUrl = useKnownApiUrl();
  const { connection } = useSyncConnection();
  const reporter = useErrorReporter();

  return useCallback(
    async (url: string, options: RunOverviewGenerationOptions, stores: RunStores = shown): Promise<Overview> =>
      runOverviewGeneration(
        url,
        {
          sources: createTranscriptSources({
            youTubeFetch,
            service: knownApiUrl === null ? null : { apiUrl: knownApiUrl, token: connection.token },
          }),
          makeOverview: makeWith(),
          overviewStore: stores.overviewStore,
          settingsStore: stores.settingsStore,
          transcriptStore: stores.transcriptStore,
          projectStore: stores.projectStore,
          warn: (warning) => reporter.warn(warning),
          timed: (timing) => reporter.time(timing),
        },
        options,
      )
        .then((overview) => learnFrom(overview, stores))
        .finally(settled),
    [makeWith, learnFrom, settled, knownApiUrl, youTubeFetch, connection.token, shown, reporter],
  );
}

export function useRunArticleGeneration(apiKeys: ApiKeys) {
  const { makeWith, learnFrom, settled } = useOverviewMaker(apiKeys);
  const shown = useStores();

  return useCallback(
    async (read: () => Promise<ArticleRead>, options: RunOverviewGenerationOptions, stores: RunStores = shown): Promise<Overview> =>
      runArticleOverviewGeneration(
        read,
        {
          makeOverview: makeWith(),
          overviewStore: stores.overviewStore,
          settingsStore: stores.settingsStore,
          projectStore: stores.projectStore,
        },
        options,
      )
        .then((overview) => learnFrom(overview, stores))
        .finally(settled),
    [makeWith, learnFrom, settled, shown],
  );
}

// An episode's words come through our server, on the account; the reader's
// extension searches YouTube for the episode on their own connection when it can
// (docs/features/podcast-on-youtube.md). Or its audio is transcribed, as the reader chose, with the
// events of that measured here, wherever the run was started (docs/features/speech-to-text.md).
export function useRunPodcastGeneration(apiKeys: ApiKeys) {
  const { makeWith, learnFrom, settled } = useOverviewMaker(apiKeys);
  const analytics = useAnalytics();
  const shown = useStores();
  const youTubeFetch = useYouTubeFetch();
  const knownApiUrl = useKnownApiUrl();
  const { connection } = useSyncConnection();

  return useCallback(
    async (request: PodcastRunRequest, options: RunOverviewGenerationOptions, stores: RunStores = shown): Promise<Overview> => {
      if (knownApiUrl === null) {
        throw new Error("Episodes are read through our server, and there isn't one here");
      }
      const api = createFetchPodcastApi({ baseUrl: knownApiUrl, token: connection.token });
      const from = options.from ?? "dialog";
      const episodeMinutes = {
        episodeMinutes: request.episode.durationSeconds === null ? undefined : Math.round(request.episode.durationSeconds / 60),
      };
      const transcribe = async (episode: typeof request.episode, onTranscription: RunOverviewGenerationOptions["onTranscription"]) => {
        const askedAt = Date.now();
        let startedAt: number | null = null;
        analytics.capture.episodeTranscription.chosen({ from, when: request.transcribe!, ...episodeMinutes });
        try {
          const words = await transcribeEpisode(api, episode, {
            isCancelled: options.isCancelled,
            onProgress: (progress: TranscriptionProgress) => {
              if (progress === "transcribing" && startedAt === null) {
                startedAt = Date.now();
              }
              onTranscription?.(progress);
            },
          });
          const doneAt = Date.now();
          analytics.capture.episodeTranscription.finished({
            from,
            waitedMs: (startedAt ?? doneAt) - askedAt,
            transcribingMs: startedAt === null ? 0 : doneAt - startedAt,
            ...episodeMinutes,
          });
          return words;
        } catch (error) {
          if (error instanceof TranscriptionFailedError) {
            analytics.capture.episodeTranscription.failed({ from, reason: error.reason });
          }
          if (error instanceof TranscriptionRefusedError) {
            analytics.capture.episodeTranscription.failed({ from, reason: error.refusal });
          }
          throw error;
        }
      };
      return runPodcastOverviewGeneration(
        request,
        (episode, { onTranscription }) =>
          request.transcribe !== undefined
            ? transcribe(episode, onTranscription)
            : podcastTranscript(api, episode, youTubeFetch).catch((error: unknown) => {
                if (error instanceof EpisodeNeedsTranscribingError) {
                  analytics.capture.episodeTranscription.asked({ from, ...episodeMinutes });
                }
                throw error;
              }),
        {
          makeOverview: makeWith(),
          overviewStore: stores.overviewStore,
          settingsStore: stores.settingsStore,
          transcriptStore: stores.transcriptStore,
          projectStore: stores.projectStore,
        },
        options,
      )
        .then((overview) => learnFrom(overview, stores))
        .finally(settled);
    },
    [makeWith, learnFrom, settled, shown, knownApiUrl, connection.token, youTubeFetch, analytics],
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
        if (ran) {
          void queryClient.invalidateQueries({ queryKey: settingsKeys.all });
        }
      });
      return overview;
    },
    [keysNow, analytics, queryClient],
  );

  const settled = useCallback(() => void queryClient.invalidateQueries({ queryKey: generationKeys.allUsage() }), [queryClient]);

  return { makeWith, learnFrom, settled };
}
