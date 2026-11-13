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
} from "@overview/domain";
import { createFetchPodcastApi } from "@overview/sync";
import { useStores } from "../../stores/StoresContext.js";
import { libraryAccountIdOf } from "../sync/types/SyncConnection.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { generationKeys } from "./generationKeys.js";
import { isYouTubeUrl, youTubeLink } from "./util/parseYouTubeUrl.js";

export type PodcastLink =
  | { status: "none" }
  | { status: "reading" }
  | { status: "found"; episode: PodcastEpisode }
  | { status: "held"; overviewId: OverviewId; savedAt: string | null }
  | { status: "failed"; reason: PodcastReadFailure; showName: string | null }
  | { status: "unreachable" };

const SETTLED_MS = 350;
const KEPT_MS = 5 * 60 * 1000;

// An Apple Podcasts or Spotify link, which is only ever an episode or a show.
export const isPlatformPodcastLink = (link: string): boolean => {
  const platform = parsePodcastLink(link)?.platform;
  return platform !== undefined && platform !== "page";
};

// Any other web page may be a show's own episode page, so it is read as one beside being read as
// an article; a page that isn't an episode says so and is left to the article
// (docs/features/podcast-links.md, "A show's own episode page").
const mayBeEpisodeLink = (link: string): boolean => {
  if (link === "" || isYouTubeUrl(link) || youTubeLink(link) !== null) return false;
  return parsePodcastLink(link) !== null;
};

// A pasted podcast link is read as soon as it settles, so the episode, or why it can't be used,
// is known before Create (designs 106a–106f). Reading costs nothing against the month. Null where
// there is no account on a server to read through.
export function usePodcastLink(url: string) {
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
        if (read.reason === "not-an-episode" && !platformLink) return { status: "none" };
        return { status: "failed", reason: read.reason, showName: read.showName ?? null };
      }
      const key = sourceKey({ kind: "podcast", id: await podcastSourceId(read.episode) })!;
      const held = await heldOverviewOf(overviewStore, key);
      if (held === null) return { status: "found", episode: read.episode };
      const overviews = await overviewStore.listOverviews();
      return {
        status: "held",
        overviewId: OverviewId.parse(held.id),
        savedAt: overviews.find(({ id }) => id === held.id)?.savedAt ?? null,
      };
    },
  });

  const podcastLink: PodcastLink = useMemo(() => {
    if (!offered) return { status: "none" };
    if (settled !== link || query.isFetching) return { status: "reading" };
    // A page we couldn't ask about is left to the article; a platform link has nowhere else to go.
    if (query.isError) return platformLink ? { status: "unreachable" } : { status: "none" };
    return query.data ?? { status: "reading" };
  }, [offered, settled, link, query.isFetching, query.isError, query.data, platformLink]);

  return { available, link: podcastLink, platformLink, retry: () => void query.refetch() };
}
