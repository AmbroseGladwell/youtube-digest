import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  heldOverviewOf,
  OverviewId,
  parsePodcastLink,
  podcastSourceId,
  sourceKey,
  type PodcastEpisode,
  type PodcastReadFailure,
  type TranscriptionOffer,
} from "@overview/domain";
import { createFetchPodcastApi } from "@overview/sync";
import { useYouTubeFetch } from "../../app/YouTubeFetchContext.js";
import { checkEpisodeWords } from "../podcasts/api/checkEpisodeWords.js";
import { useStores } from "../../stores/StoresContext.js";
import { libraryAccountIdOf } from "../sync/types/SyncConnection.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { generationKeys } from "./generationKeys.js";
import { isYouTubeUrl, youTubeLink } from "./util/parseYouTubeUrl.js";

// `unknown` when the check couldn't tell, so Create looks again.
export type EpisodeWords =
  | { state: "checking" }
  | { state: "found" }
  | { state: "unknown" }
  | { state: "none"; transcription: TranscriptionOffer };

export type PodcastLink =
  | { status: "none" }
  | { status: "reading" }
  | { status: "found"; episode: PodcastEpisode; words: EpisodeWords }
  | { status: "held"; episode: PodcastEpisode; overviewId: OverviewId; savedAt: string | null }
  | { status: "failed"; reason: PodcastReadFailure; showName: string | null }
  | { status: "unreachable" };

const SETTLED_MS = 350;
const KEPT_MS = 5 * 60 * 1000;

export const isPlatformPodcastLink = (link: string): boolean => {
  const platform = parsePodcastLink(link)?.platform;
  return platform !== undefined && platform !== "page";
};

export const isPodcastShowLink = (link: string): boolean => {
  const platform = parsePodcastLink(link)?.platform;
  return platform === "apple-show" || platform === "spotify-show";
};

// docs/features/podcast-links.md, "From a link to an episode".
const mayBeEpisodeLink = (link: string): boolean => {
  if (link === "" || isYouTubeUrl(link) || youTubeLink(link) !== null) {
    return false;
  }
  return parsePodcastLink(link) !== null;
};

// Read as soon as it settles: docs/features/podcast-screens.md, "Making one".
export const usePodcastLink = (url: string) => {
  const apiUrl = useKnownApiUrl();
  const { connection } = useSyncConnection();
  const { overviewStore } = useStores();
  const available = apiUrl !== null && libraryAccountIdOf(connection) !== null;

  const link = url.trim();
  const [settled, setSettled] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSettled(link), SETTLED_MS);
    return () => clearTimeout(timer);
  }, [link]);

  const platformLink = isPlatformPodcastLink(link);
  const offered = available && mayBeEpisodeLink(link);
  const query = useQuery({
    queryKey: [...generationKeys.all, "podcastLink", settled],
    enabled: offered && settled === link,
    retry: false,
    staleTime: KEPT_MS,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<PodcastLink> => {
      const read = await createFetchPodcastApi({ baseUrl: apiUrl!, token: connection.token }).read(link);
      if (read.status === "failed") {
        // A page that isn't an episode is most likely an article, which reads it instead.
        if (read.reason === "not-an-episode" && !platformLink) {
          return { status: "none" };
        }
        return { status: "failed", reason: read.reason, showName: read.showName ?? null };
      }
      const key = sourceKey({ kind: "podcast", id: await podcastSourceId(read.episode) })!;
      const held = await heldOverviewOf(overviewStore, key);
      if (held === null) {
        return { status: "found", episode: read.episode, words: { state: "checking" } };
      }
      const overviews = await overviewStore.listOverviews();
      return {
        status: "held",
        episode: read.episode,
        overviewId: OverviewId.parse(held.id),
        savedAt: overviews.find(({ id }) => id === held.id)?.savedAt ?? null,
      };
    },
  });

  // Nothing is fetched or counted, so a failed check only means "can't tell", and Create looks again.
  const found = query.data?.status === "found" ? query.data.episode : null;
  const youTubeFetch = useYouTubeFetch();
  const check = useQuery({
    queryKey: [...generationKeys.all, "episodeWords", found?.feedUrl ?? null, found?.guid ?? null],
    enabled: found !== null && !query.isFetching,
    retry: false,
    staleTime: KEPT_MS,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<EpisodeWords> => {
      const checked = await checkEpisodeWords(createFetchPodcastApi({ baseUrl: apiUrl!, token: connection.token }), found!, youTubeFetch);
      return checked.words === "none" ? { state: "none", transcription: checked.transcription } : { state: checked.words };
    },
  });
  const words: EpisodeWords = useMemo(() => {
    if (check.isError) {
      return { state: "unknown" };
    }
    return check.isFetching ? { state: "checking" } : (check.data ?? { state: "checking" });
  }, [check.isError, check.isFetching, check.data]);

  const podcastLink: PodcastLink = useMemo(() => {
    if (!offered) {
      return { status: "none" };
    }
    if (settled !== link || query.isFetching) {
      return { status: "reading" };
    }
    // A page we couldn't ask about is left to the article; a platform link has nowhere else to go.
    if (query.isError) {
      return platformLink ? { status: "unreachable" } : { status: "none" };
    }
    if (query.data?.status === "found") {
      return { ...query.data, words };
    }
    return query.data ?? { status: "reading" };
  }, [offered, settled, link, query.isFetching, query.isError, query.data, platformLink, words]);

  return { available, link: podcastLink, platformLink, retry: () => void query.refetch() };
};
