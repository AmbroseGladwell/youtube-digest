import { useEffect, useRef, useState } from "react";
import type { TranscribeChoice, Overview, PodcastEpisode, PodcastRead } from "@overview/domain";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { useApiKeys } from "../apiKeys/useApiKeys.js";
import { GenerationCancelledError } from "../newOverview/api/GenerationCancelledError.js";
import {
  useRunArticleGeneration,
  useRunOverviewGeneration,
  useRunPodcastGeneration,
  useRunTikTokGeneration,
  useRunSocialGeneration,
} from "../newOverview/useRunOverviewGeneration.js";
import { createFetchPodcastApi, createFetchSocialApi, createFetchTikTokApi, createFetchVideoApi } from "@overview/sync";
import { createTrialTikTokApi } from "../signedOutTrial/api/createTrialTikTokApi.js";
import { createTrialSocialApi } from "../signedOutTrial/api/createTrialSocialApi.js";
import { useTikTokPages } from "../../app/TikTokPagesContext.js";
import { readTikTokLink } from "../tiktok/api/readTikTokLink.js";
import { createTrialPodcastApi } from "../signedOutTrial/api/createTrialPodcastApi.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { libraryAccountIdOf } from "../sync/types/SyncConnection.js";
import { useArticlePages } from "../../app/ArticlePagesContext.js";
import { useLibraryAccountId } from "../../stores/LibraryAccountContext.js";
import { useStores } from "../../stores/StoresContext.js";
import { createTrialArticleApi } from "../signedOutTrial/api/createTrialArticleApi.js";
import { createTrialVideoApi } from "../signedOutTrial/api/createTrialVideoApi.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";
import { useYouTubeFetch } from "../../app/YouTubeFetchContext.js";
import { checkEpisodeWords } from "../podcasts/api/checkEpisodeWords.js";
import { EpisodeCannotBeMadeError } from "./EpisodeCannotBeMadeError.js";
import type { EpisodeTranscription } from "../podcasts/types/EpisodeTranscription.js";
import { foundIn, type OnboardingFound, type OnboardingMakers, type OnboardingSource } from "./onboardingSources.js";
import { pageAccessFor } from "./pageAccess.js";
import { onboardingFailureOf, type OnboardingFailure } from "./util/onboardingFailureOf.js";
import { rememberEpisodeRead } from "./util/rememberEpisodeRead.js";
import { onboardingKindOf } from "./util/onboardingKindOf.js";

const NO_SERVER = "There's no server to read that link through.";

export type OnboardingRunPhase = "fetching" | "waiting" | "writing" | "ready" | "failed";

export interface OnboardingRun {
  phase: OnboardingRunPhase;
  found: OnboardingFound | null;
  overview: Overview | null;
  failure: OnboardingFailure | null;
  // Kept once done, so the wait still says the episode was transcribed.
  transcription: EpisodeTranscription | null;
  sourceWords: number | null;
  writingStarted: boolean;
}

const FETCHING: OnboardingRun = {
  phase: "fetching",
  found: null,
  overview: null,
  failure: null,
  transcription: null,
  sourceWords: null,
  writingStarted: false,
};

export interface UseOnboardingRunOptions {
  source: OnboardingSource | null;
  target: string | null;
  tabId: number | null;
  maySpend: boolean;
  attempt: number;
  transcribe?: TranscribeChoice | undefined;
  onFound: (found: OnboardingFound) => void;
  onMade: (overview: Overview) => void;
}

// docs/features/onboarding.md, "Nothing paid before the account".
export const useOnboardingRun = ({
  source,
  target,
  tabId,
  maySpend,
  attempt,
  transcribe,
  onFound,
  onMade,
}: UseOnboardingRunOptions): OnboardingRun => {
  const { apiKeys } = useApiKeys();
  const runVideo = useRunOverviewGeneration(apiKeys);
  const runArticle = useRunArticleGeneration(apiKeys);
  const runPodcast = useRunPodcastGeneration(apiKeys);
  const runTikTok = useRunTikTokGeneration(apiKeys);
  const runSocial = useRunSocialGeneration(apiKeys);
  const tiktokPages = useTikTokPages();
  const { connection } = useSyncConnection();
  const knownApiUrl = useKnownApiUrl();
  const pages = useArticlePages();
  const analytics = useAnalytics();
  const shown = useStores();
  const signedIn = useLibraryAccountId() !== null;
  const youTubeFetch = useYouTubeFetch();
  // Kept with the try it belongs to, so a new try never shows the last one's result.
  const key = `${target ?? ""}#${attempt}`;
  const [state, setState] = useState<{ key: string; run: OnboardingRun }>({ key, run: FETCHING });
  const setRun = (next: OnboardingRun | ((current: OnboardingRun) => OnboardingRun)) =>
    setState((current) => ({ key, run: typeof next === "function" ? next(current.run) : next }));
  const readArticle = async (url: string) => {
    if (tabId !== null && pages !== null && (await pageAccessFor(pages, url))) {
      return pages.read(tabId);
    }
    if (knownApiUrl === null) {
      throw new Error(NO_SERVER);
    }
    return createTrialArticleApi({ baseUrl: knownApiUrl }).read(url);
  };
  const readVideo = async (videoId: string) => {
    if (knownApiUrl === null) {
      throw new Error(NO_SERVER);
    }
    return signedIn
      ? createFetchVideoApi({ baseUrl: knownApiUrl, token: connection.token }).read(videoId)
      : createTrialVideoApi({ baseUrl: knownApiUrl }).read(videoId);
  };
  const readPodcast = async (url: string) => {
    if (knownApiUrl === null) {
      throw new Error(NO_SERVER);
    }
    return libraryAccountIdOf(connection) !== null
      ? createFetchPodcastApi({ baseUrl: knownApiUrl, token: connection.token }).read(url)
      : createTrialPodcastApi({ baseUrl: knownApiUrl }).read(url);
  };
  const readTikTok = async (url: string) => {
    if (knownApiUrl === null) {
      throw new Error(NO_SERVER);
    }
    const api =
      libraryAccountIdOf(connection) !== null
        ? createFetchTikTokApi({ baseUrl: knownApiUrl, token: connection.token })
        : createTrialTikTokApi({ baseUrl: knownApiUrl });
    return readTikTokLink(url, { own: tiktokPages, server: api.read });
  };
  const readSocial = async (url: string) => {
    if (knownApiUrl === null) {
      throw new Error(NO_SERVER);
    }
    const api =
      libraryAccountIdOf(connection) !== null
        ? createFetchSocialApi({ baseUrl: knownApiUrl, token: connection.token })
        : createTrialSocialApi({ baseUrl: knownApiUrl });
    return api.read(url);
  };
  const checkEpisode = async (episode: PodcastEpisode) => {
    if (knownApiUrl === null) {
      throw new Error("There's no server to check that episode through.");
    }
    const api =
      libraryAccountIdOf(connection) !== null
        ? createFetchPodcastApi({ baseUrl: knownApiUrl, token: connection.token })
        : createTrialPodcastApi({ baseUrl: knownApiUrl });
    return checkEpisodeWords(api, episode, youTubeFetch);
  };
  const latest = useRef({
    source,
    runVideo,
    runArticle,
    runPodcast,
    runTikTok,
    runSocial,
    readArticle,
    readVideo,
    readPodcast,
    readTikTok,
    readSocial,
    checkEpisode,
    onFound,
    onMade,
    analytics,
    shown,
  });
  const transcribeNow = useRef(transcribe);
  transcribeNow.current = transcribe;
  latest.current = {
    source,
    runVideo,
    runArticle,
    runPodcast,
    runTikTok,
    runSocial,
    readArticle,
    readVideo,
    readPodcast,
    readTikTok,
    readSocial,
    checkEpisode,
    onFound,
    onMade,
    analytics,
    shown,
  };
  const episodeReads = useRef(new Map<string, Promise<PodcastRead>>());
  const maySpendNow = useRef(maySpend);
  const releaseSpending = useRef<(() => void) | null>(null);
  // When the run read its link, so the gate opening can say how long the value shown up front held.
  const readAt = useRef<number | null>(null);

  useEffect(() => {
    maySpendNow.current = maySpend;
    if (maySpend) {
      releaseSpending.current?.();
    }
    if (maySpend && state.run.phase === "waiting" && readAt.current !== null) {
      latest.current.analytics.onboarding.spend.released({
        ...(state.run.found === null ? {} : { kind: onboardingKindOf(state.run.found) }),
        seconds: Math.max(0, Math.round((Date.now() - readAt.current) / 1000)),
      });
      readAt.current = null;
    }
    setRun((current) => (maySpend && current.phase === "waiting" ? { ...current, phase: "writing" } : current));
  }, [maySpend]);

  useEffect(() => {
    const kind = latest.current.source;
    if (target === null || kind === null) {
      return;
    }
    let cancelled = false;
    setRun(FETCHING);
    latest.current.analytics.capture.newOverview.started({ from: "onboarding" });
    const spending = new Promise<void>((resolve) => {
      releaseSpending.current = resolve;
      if (maySpendNow.current) {
        resolve();
      }
    });

    // Every maker that writes is called after `spending` settles, so the library is the account's.
    const makers: OnboardingMakers = {
      video: (url, options) => latest.current.runVideo(url, options, latest.current.shown),
      readVideo: (videoId) => latest.current.readVideo(videoId),
      keepTranscript: (transcript) => latest.current.shown.transcriptStore.saveTranscript(transcript),
      article: (read, options) => latest.current.runArticle(read, options, latest.current.shown),
      readArticle: (url) => latest.current.readArticle(url),
      podcast: (request, options) => latest.current.runPodcast(request, options, latest.current.shown),
      readPodcast: (url) => rememberEpisodeRead(episodeReads.current, url, latest.current.readPodcast),
      checkEpisode: (episode) => latest.current.checkEpisode(episode),
      readTikTok: (url) => latest.current.readTikTok(url),
      tiktok: (request, options) => latest.current.runTikTok(request, options, latest.current.shown),
      readSocial: (url) => latest.current.readSocial(url),
      social: (request, options) => latest.current.runSocial(request, options, latest.current.shown),
    };

    kind
      .make(target, makers, {
        isCancelled: () => cancelled,
        waitToSpend: () => spending,
        transcribe: transcribeNow.current,
        onTranscription: (progress) => {
          if (cancelled) {
            return;
          }
          setRun((current) => {
            if (current.transcription?.state === "transcribing") {
              return current;
            }
            if (progress === "transcribing") {
              return { ...current, transcription: { state: "transcribing", since: Date.now() } };
            }
            return { ...current, transcription: { state: "starting" } };
          });
        },
        onSourceWords: (words) => {
          if (!cancelled) {
            setRun((current) => ({ ...current, sourceWords: words }));
          }
        },
        onWriting: () => {
          if (!cancelled) {
            setRun((current) => ({ ...current, writingStarted: true }));
          }
        },
        onFound: (found) => {
          if (cancelled) {
            return;
          }
          if (!maySpendNow.current) {
            readAt.current = Date.now();
          }
          latest.current.onFound(found);
          setRun((current) =>
            current.phase === "fetching" ? { ...FETCHING, phase: maySpendNow.current ? "writing" : "waiting", found } : current,
          );
        },
      })
      .then((overview) => {
        if (cancelled) {
          return;
        }
        latest.current.onMade(overview);
        setRun((current) => ({ ...current, phase: "ready", found: foundIn(overview), overview, failure: null }));
      })
      .catch((error: unknown) => {
        if (cancelled || error instanceof GenerationCancelledError || error instanceof EpisodeCannotBeMadeError) {
          return;
        }
        setRun((current) => ({ ...current, phase: "failed", failure: onboardingFailureOf(error) }));
      });

    return () => {
      cancelled = true;
      releaseSpending.current?.();
    };
  }, [target, attempt]);

  return target === null || state.key === key ? state.run : FETCHING;
};
